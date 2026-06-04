import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  qualifications,
  stripeCustomers,
  subscriptions,
} from "@/lib/db/schema";
import { ACTIVE_STATUSES } from "@/lib/stripe";

export type SubscriptionRow = {
  id: string;
  status: string;
  priceId: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

export type BillingState = {
  isPro: boolean;
  stripeCustomerId: string | null;
  subscription: SubscriptionRow | null;
};

export async function getBillingState(userId: string): Promise<BillingState> {
  const [sub, customer] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        status: subscriptions.status,
        priceId: subscriptions.priceId,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1)
      .then((rows) => rows[0] ?? null),

    db
      .select({ stripeCustomerId: stripeCustomers.stripeCustomerId })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const isPro =
    !!sub &&
    ACTIVE_STATUSES.has(sub.status) &&
    sub.currentPeriodEnd > new Date();

  return {
    isPro,
    stripeCustomerId: customer?.stripeCustomerId ?? null,
    subscription: sub ?? null,
  };
}

export async function getCompletedTodayUTC(userId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ value: count() })
    .from(qualifications)
    .where(
      and(
        eq(qualifications.userId, userId),
        eq(qualifications.status, "completed"),
        gte(qualifications.createdAt, start),
      ),
    );

  return row?.value ?? 0;
}
