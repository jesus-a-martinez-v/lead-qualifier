import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stripeCustomers } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [customer] = await db
    .select({ stripeCustomerId: stripeCustomers.stripeCustomerId })
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, session.user.id))
    .limit(1);

  if (!customer?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer for this account. Upgrade first." },
      { status: 400 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(req.url).origin;

  const portalSession = await stripe().billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${origin}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
