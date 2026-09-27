"use client";

import { useState } from "react";

export function Pill({ tone, children }: { tone: "ok" | "bad" | "warn" | "neutral"; children: React.ReactNode }) {
  const cls = { ok: "pill-ok", bad: "pill-bad", warn: "pill-warn", neutral: "pill-neutral" }[tone];
  return <span className={`pill ${cls}`}>{children}</span>;
}

export function Hash({ value, chars = 10 }: { value: string; chars?: number }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted">—</span>;
  const short = value.length > chars * 2 ? `${value.slice(0, chars)}…${value.slice(-chars)}` : value;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={value}
      className="font-code text-xs px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors inline-flex items-center gap-1"
    >
      {short}
      <span className="text-[10px] text-muted">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  desc,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="text-xs font-semibold tracking-[0.14em] text-accent uppercase mb-1.5">{eyebrow}</div>}
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
      {desc && <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">{desc}</p>}
    </div>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center flex flex-col items-center gap-3">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted max-w-md">{desc}</p>
      {action}
    </div>
  );
}
