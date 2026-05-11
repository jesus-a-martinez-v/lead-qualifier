import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!customer?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer for this account. Upgrade first." },
      { status: 400 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(req.url).origin;

  const session = await stripe().billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: `${origin}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
