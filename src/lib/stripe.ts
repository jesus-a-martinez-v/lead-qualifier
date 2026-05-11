import Stripe from "stripe";

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (test key from https://dashboard.stripe.com/test/apikeys).",
    );
  }
  cached = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  return cached;
}

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

// Statuses that grant access to paid features.
export const ACTIVE_STATUSES = new Set(["active", "trialing"]);
