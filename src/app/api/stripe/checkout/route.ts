import { NextResponse, type NextRequest } from "next/server";
import { stripe, STRIPE_PRICE_ID } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!STRIPE_PRICE_ID) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID is not set. Add the $29/mo recurring price id to env." },
      { status: 500 },
    );
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: existing } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    const { error: insertError } = await admin
      .from("stripe_customers")
      .insert({ user_id: user.id, stripe_customer_id: customerId });
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(req.url).origin;

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/billing?upgraded=1`,
    cancel_url: `${origin}/billing`,
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe returned no checkout URL." }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
