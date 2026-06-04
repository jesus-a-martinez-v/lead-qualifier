import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { stripe, STRIPE_PRICE_ID } from "@/lib/stripe";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stripeCustomers } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!STRIPE_PRICE_ID) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID is not set. Add the $29/mo recurring price id to env." },
      { status: 500 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const userEmail = session.user.email ?? undefined;

  const [existing] = await db
    .select({ stripeCustomerId: stripeCustomers.stripeCustomerId })
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);

  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: userEmail,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await db
      .insert(stripeCustomers)
      .values({ userId, stripeCustomerId: customerId });
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(req.url).origin;

  const checkoutSession = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/billing?upgraded=1`,
    cancel_url: `${origin}/billing`,
    client_reference_id: userId,
    metadata: { user_id: userId },
    subscription_data: { metadata: { user_id: userId } },
    allow_promotion_codes: true,
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe returned no checkout URL." }, { status: 500 });
  }
  return NextResponse.json({ url: checkoutSession.url });
}
