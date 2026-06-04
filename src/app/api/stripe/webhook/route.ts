import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { stripeCustomers, subscriptions } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("STRIPE_WEBHOOK_SECRET is not set", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature header", { status: 400 });

  // Raw body required for signature verification — must not parse as JSON.
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Bad signature: ${msg}`, { status: 400 });
  }

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

        await db
          .insert(stripeCustomers)
          .values({ userId, stripeCustomerId: customerId })
          .onConflictDoUpdate({
            target: stripeCustomers.userId,
            set: { stripeCustomerId: customerId },
          });

        const sub = await stripe().subscriptions.retrieve(subId);
        await upsertSubscription(userId, sub);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const userId =
          sub.metadata?.user_id ?? (await lookupUserByCustomerId(customerId));

        if (!userId) break;

        await db
          .insert(stripeCustomers)
          .values({ userId, stripeCustomerId: customerId })
          .onConflictDoUpdate({
            target: stripeCustomers.userId,
            set: { stripeCustomerId: customerId },
          });

        await upsertSubscription(userId, sub);
        break;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Webhook handler error: ${msg}`, { status: 500 });
  }

  return new NextResponse("ok");
}

async function lookupUserByCustomerId(customerId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: stripeCustomers.userId })
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}

async function upsertSubscription(userId: string, sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  if (!priceId) throw new Error(`Subscription ${sub.id} has no price`);

  const periodStart = item?.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? null;
  if (periodStart == null || periodEnd == null) {
    throw new Error(`Subscription ${sub.id} has no current_period bounds`);
  }

  await db
    .insert(subscriptions)
    .values({
      id: sub.id,
      userId,
      status: sub.status,
      priceId,
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        userId,
        status: sub.status,
        priceId,
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        updatedAt: new Date(),
      },
    });
}
