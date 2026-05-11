"use client";

import { useState } from "react";

async function redirectTo(endpoint: string): Promise<string | null> {
  const res = await fetch(endpoint, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  const { url } = (await res.json()) as { url?: string };
  return url ?? null;
}

export function UpgradeButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setPending(true);
    try {
      const url = await redirectTo("/api/stripe/checkout");
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("Stripe returned no URL");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={onClick} className="cta" disabled={pending}>
        {pending ? "Loading…" : label}
        <span className="cta__arrow" aria-hidden>
          →
        </span>
      </button>
      {error && (
        <p className="mt-4 border-l-2 border-[color:var(--ember)] pl-4 text-sm text-[color:var(--ember)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function ManageButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setPending(true);
    try {
      const url = await redirectTo("/api/stripe/portal");
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("Stripe returned no URL");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-sm text-[color:var(--muted)] underline-offset-4 hover:text-[color:var(--ink)] hover:underline"
      >
        {pending ? "Opening…" : "Manage subscription →"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-[color:var(--ember)]">{error}</p>
      )}
    </div>
  );
}
