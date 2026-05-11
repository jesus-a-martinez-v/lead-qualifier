"use client";

import { useRef, useState, useTransition } from "react";
import { qualifyAction, type QualifyHandle } from "../actions/qualify";
import { LeadInputSchema, type LeadInput } from "@/types/lead";
import { QualificationView } from "./qualification-view";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

type FormState = {
  email: string;
  company: string;
  fullName: string;
  website: string;
  role: string;
  companySize: (typeof COMPANY_SIZES)[number] | "";
  industry: string;
  source: string;
  notes: string;
};

const EMPTY: FormState = {
  email: "",
  company: "",
  fullName: "",
  website: "",
  role: "",
  companySize: "",
  industry: "",
  source: "",
  notes: "",
};

function toLeadInput(s: FormState): LeadInput {
  const out: LeadInput = { email: s.email.trim(), company: s.company.trim() };
  if (s.fullName.trim()) out.fullName = s.fullName.trim();
  if (s.website.trim()) out.website = s.website.trim();
  if (s.role.trim()) out.role = s.role.trim();
  if (s.companySize) out.companySize = s.companySize;
  if (s.industry.trim()) out.industry = s.industry.trim();
  if (s.source.trim()) out.source = s.source.trim();
  if (s.notes.trim()) out.notes = s.notes.trim();
  return out;
}

export function LeadForm() {
  const [state, setState] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<QualifyHandle | null>(null);
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setHandle(null);

    const candidate = toLeadInput(state);
    const parsed = LeadInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
          .join(" · ")
      );
      return;
    }

    startTransition(async () => {
      const res = await qualifyAction(parsed.data);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHandle(res.handle);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  };

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          <div className="col-span-12 sm:col-span-6">
            <Field
              label="Email"
              id="email"
              required
              type="email"
              value={state.email}
              onChange={(v) => update("email", v)}
              placeholder="kayla@acme.com"
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <Field
              label="Company"
              id="company"
              required
              value={state.company}
              onChange={(v) => update("company", v)}
              placeholder="Acme Inc."
            />
          </div>
        </div>

        <div className="mt-16 mb-8 flex items-center gap-4">
          <div className="eyebrow">Optional context</div>
          <div className="h-px flex-1 bg-[color:var(--rule)]" />
        </div>

        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          <div className="col-span-12 sm:col-span-6">
            <Field
              label="Full name"
              id="fullName"
              value={state.fullName}
              onChange={(v) => update("fullName", v)}
              placeholder="Kayla Park"
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <Field
              label="Role / title"
              id="role"
              value={state.role}
              onChange={(v) => update("role", v)}
              placeholder="VP of Engineering"
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <Field
              label="Website"
              id="website"
              type="url"
              value={state.website}
              onChange={(v) => update("website", v)}
              placeholder="https://acme.com"
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <Field
              label="Industry"
              id="industry"
              value={state.industry}
              onChange={(v) => update("industry", v)}
              placeholder="B2B SaaS"
            />
          </div>

          <div className="col-span-12 sm:col-span-8">
            <div className="field-label mb-3">Company size</div>
            <div className="flex flex-wrap gap-2">
              {COMPANY_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="chip"
                  aria-pressed={state.companySize === size}
                  onClick={() =>
                    update(
                      "companySize",
                      state.companySize === size ? "" : size
                    )
                  }
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-12 sm:col-span-4">
            <Field
              label="Source"
              id="source"
              value={state.source}
              onChange={(v) => update("source", v)}
              placeholder="Inbound · referral · cold"
            />
          </div>

          <div className="col-span-12">
            <div className="field-label mb-3">SDR notes</div>
            <textarea
              id="notes"
              className="field-input min-h-[5.5rem] resize-y"
              value={state.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="What they said on the call, anything they care about, urgency signals…"
              rows={4}
            />
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-sm leading-relaxed text-[color:var(--muted)]">
            Analysis runs against the BANT rubric using an LLM. Results stream
            back live — no refresh needed.
          </p>
          <button type="submit" className="cta" disabled={pending}>
            {pending ? "Sending…" : "Analyze"}
            <span className="cta__arrow" aria-hidden>
              →
            </span>
          </button>
        </div>

        {error && (
          <p className="mt-6 border-l-2 border-[color:var(--ember)] pl-4 text-sm text-[color:var(--ember)]">
            {error}
          </p>
        )}
      </form>

      <div ref={resultRef} className="mt-24">
        {handle && (
          <QualificationView
            key={handle.runId}
            runId={handle.runId}
            publicAccessToken={handle.publicAccessToken}
          />
        )}
      </div>
    </>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const { id, label, value, onChange, required, type = "text", placeholder } = props;
  return (
    <div>
      <label htmlFor={id} className="field-label mb-1 block">
        {label}
        {required && <span className="ml-1 text-[color:var(--ember)]">*</span>}
      </label>
      <input
        id={id}
        type={type}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
