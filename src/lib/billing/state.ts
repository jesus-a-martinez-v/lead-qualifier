import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIVE_STATUSES } from "@/lib/stripe";

export type SubscriptionRow = {
  id: string;
  status: string;
  price_id: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
};

export type BillingState = {
  isPro: boolean;
  stripeCustomerId: string | null;
  subscription: SubscriptionRow | null;
};

export async function getBillingState(
  supabase: SupabaseClient,
  userId: string,
): Promise<BillingState> {
  const [{ data: sub }, { data: customer }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRow>(),
    supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle<{ stripe_customer_id: string }>(),
  ]);

  const isPro =
    !!sub &&
    ACTIVE_STATUSES.has(sub.status) &&
    new Date(sub.current_period_end) > new Date();

  return {
    isPro,
    stripeCustomerId: customer?.stripe_customer_id ?? null,
    subscription: sub ?? null,
  };
}

export async function getCompletedTodayUTC(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("qualifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("created_at", start.toISOString());
  return count ?? 0;
}
