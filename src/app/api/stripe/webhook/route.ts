import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("STRIPE_WEBHOOK_SECRET is not set", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature header", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Bad signature: ${msg}`, { status: 400 });
  }

  const admin = supabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (!userId || !customerId || !subId) break;

        await admin
          .from("stripe_customers")
          .upsert(
            { user_id: userId, stripe_customer_id: customerId },
            { onConflict: "user_id" },
          );

        const sub = await stripe().subscriptions.retrieve(subId);
        await upsertSubscription(admin, userId, sub);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const userId =
          sub.metadata?.user_id ??
          (await lookupUserByCustomerId(admin, customerId));

        if (!userId) break;

        const { error: custErr } = await admin
          .from("stripe_customers")
          .upsert(
            { user_id: userId, stripe_customer_id: customerId },
            { onConflict: "user_id" },
          );
        if (custErr) throw new Error(`stripe_customers upsert: ${custErr.message}`);
        await upsertSubscription(admin, userId, sub);
        break;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Webhook handler error: ${msg}`, { status: 500 });
  }

  return new NextResponse("ok");
}

async function lookupUserByCustomerId(
  admin: ReturnType<typeof supabaseAdmin>,
  customerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function upsertSubscription(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  sub: Stripe.Subscription,
) {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  if (!priceId) throw new Error(`Subscription ${sub.id} has no price`);

  const periodStart = item?.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? null;
  if (periodStart == null || periodEnd == null) {
    throw new Error(`Subscription ${sub.id} has no current_period bounds`);
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      id: sub.id,
      user_id: userId,
      status: sub.status,
      price_id: priceId,
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Failed to upsert subscription ${sub.id}: ${error.message}`);
}
