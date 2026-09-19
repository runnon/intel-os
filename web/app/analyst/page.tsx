"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import { requestAnalystDraft, type AnalystMessage } from "@/lib/analyst-client";

const SUGGESTIONS = [
  "Draft a report on threats to US basing in CENTCOM over the issue window.",
  "Summarize maritime and chokepoint events, with sourcing caveats.",
  "What changed since the previous issue? Facts only.",
];

type Gate = {
  loading: boolean;
  signedIn: boolean;
  active: boolean;
  email: string | null;
  status: string;
  plan: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  accessKind: "none" | "paid" | "free_beta";
};

const INITIAL_GATE: Gate = {
  loading: true,
  signedIn: false,
  active: false,
  email: null,
  status: "none",
  plan: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  trialEnd: null,
  accessKind: "none",
};

const PAYMENT_ISSUE = new Set(["past_due", "unpaid", "incomplete", "paused"]);

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AnalystPage() {
  const [messages, setMessages] = useState<AnalystMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gate, setGate] = useState<Gate>(INITIAL_GATE);
  const [prices, setPrices] = useState<{ monthly: string; annual: string; trialEligible: boolean; trialDraftLimit: number } | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [betaReveal, setBetaReveal] = useState<{ plan: "monthly" | "annual"; label: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const d = await fetch("/api/entitlement", { cache: "no-store" }).then((r) => r.json());
      const next: Gate = {
        loading: false,
        signedIn: !!d.signedIn,
        active: !!d.active,
        email: d.email ?? null,
        status: d.status ?? "none",
        plan: d.plan ?? null,
        currentPeriodEnd: d.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: !!d.cancelAtPeriodEnd,
        trialEnd: d.trialEnd ?? null,
        accessKind: d.accessKind === "free_beta" ? "free_beta" : d.accessKind === "paid" ? "paid" : "none",
      };
      setGate(next);
      return next.active;
    } catch {
      setGate((g) => ({ ...g, loading: false }));
      return false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const paymentIssue = PAYMENT_ISSUE.has(gate.status);

  // Signed in but not subscribed → load the user's A/B-assigned prices.
  useEffect(() => {
    if (gate.loading || !gate.signedIn || gate.active || paymentIssue || prices) return;
    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrices({
        monthly: d.monthly.label,
        annual: d.annual.label,
        trialEligible: !!d.trialEligible,
        trialDraftLimit: Number(d.trialDraftLimit),
      }))
      .catch(() => undefined);
  }, [gate.loading, gate.signedIn, gate.active, paymentIssue, prices]);

  // Returning from Checkout: the entitlement is granted asynchronously by the webhook,
  // so poll briefly instead of showing the paywall to someone who just paid.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    window.history.replaceState({}, "", "/analyst");
    let cancelled = false;
    let tries = 0;
    setActivating(true);
    const tick = async () => {
      if (cancelled) return;
      const active = await refresh();
      tries += 1;
      if (active || tries >= 8) {
        setActivating(false);
        return;
      }
      setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: AnalystMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setElapsedSeconds(0);
    setBusy(true);
    try {
      const draft = await requestAnalystDraft(next);
      setMessages([...next, { role: "assistant", content: draft }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠ ${e instanceof Error ? e.message : "Drafting failed. Try again."}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  async function redirectVia(endpoint: string, body?: unknown) {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Billing is temporarily unavailable.");
      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Billing is temporarily unavailable.");
      setCheckoutBusy(false);
    }
  }

  const manageBilling = () => redirectVia("/api/stripe/portal");

  // Free-beta: grant access only after a verified user chooses a priced plan. The
  // click is recorded as price intent, then the no-charge beta access is revealed.
  async function claimFree(plan: "monthly" | "annual") {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/access/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not grant access.");
      }
      const active = await refresh();
      if (!active) throw new Error("Access was granted but could not be verified. Refresh and try again.");
      setBetaReveal({ plan, label: plan === "monthly" ? monthlyLabel : annualLabel });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not grant access.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  const planLabel = gate.plan ? `${gate.plan[0].toUpperCase()}${gate.plan.slice(1)}` : "Analyst";
  const monthlyLabel = prices?.monthly ?? "$20 / month";
  const annualLabel = prices?.annual ?? "$190 / year";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="border-b border-[#c9c2ac] px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 bg-[#efeadb] shrink-0">
        <a href="/" className="font-mono text-xs tracking-widest text-[#6b675c] hover:text-[#8a6100]">
          // THEATER PICTURE
        </a>
        <span className="headline text-xl">ANALYST DRAFTING</span>
        <span className="font-mono text-[10px] text-[#8a2f2f] ml-auto">
          MACHINE-GENERATED DRAFTS · REPORTED FACTS ONLY · NOT A PUBLISHED PRODUCT
        </span>
      </header>

      {gate.active && (
        <div className="border-b border-[#c9c2ac] bg-[#f5f2ea] px-4 py-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap font-mono text-[10px] text-[#6b675c] shrink-0">
          <span>{gate.email}</span>
          <span className="text-[#c9c2ac]">·</span>
          <span>{planLabel}</span>
          {gate.accessKind === "free_beta" ? (
            <span className="text-[#1f4a2e]">FREE BETA ACCESS · NO CARD ON FILE</span>
          ) : gate.currentPeriodEnd && (
            <span className={gate.cancelAtPeriodEnd ? "text-[#8a2f2f]" : ""}>
              {gate.status === "trialing"
                ? `trial ends ${fmtDate(gate.trialEnd ?? gate.currentPeriodEnd)}`
                : gate.cancelAtPeriodEnd
                  ? `cancels ${fmtDate(gate.currentPeriodEnd)}`
                  : `renews ${fmtDate(gate.currentPeriodEnd)}`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {gate.accessKind !== "free_beta" && (
              <button
                onClick={manageBilling}
                disabled={checkoutBusy}
                className="underline hover:text-[#8a6100] disabled:opacity-50"
              >
                Manage billing
              </button>
            )}
            <form action="/auth/signout" method="post">
              <button type="submit" className="underline hover:text-[#8a6100]">Sign out</button>
            </form>
          </div>
        </div>
      )}

      {gate.loading ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="font-mono text-xs text-[#6b675c]">Loading…</p>
        </div>
      ) : activating ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="headline text-xl">Activating your subscription…</p>
            <p className="text-sm text-black/60 mt-2">This takes a few seconds while the payment confirms.</p>
          </div>
        </div>
      ) : !gate.active ? (
        <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-4">
          <div className="w-full max-w-md border border-[#c9c2ac] bg-[#f5f2ea] p-6 text-center">
            <span className="tag">Step 2 of 2 · Analyst tier</span>
            <h2 className="headline text-2xl mt-3">Drafting workspace</h2>
            {paymentIssue ? (
              <>
                <p className="text-sm text-black/70 mt-2 leading-relaxed">
                  Your subscription needs attention — the last payment didn&apos;t go through.
                  Update your payment method to restore access.
                </p>
                <button
                  onClick={manageBilling}
                  disabled={checkoutBusy}
                  className="mt-5 bg-[#8a2f2f] text-white text-sm font-semibold px-6 py-2.5 hover:opacity-90 disabled:opacity-50"
                >
                  {checkoutBusy ? "Opening…" : "Update payment method"}
                </button>
                <div className="font-mono text-[10px] text-[#6b675c] mt-3">
                  Signed in as {gate.email} ·{" "}
                  <form action="/auth/signout" method="post" className="inline">
                    <button type="submit" className="underline hover:text-[#8a6100]">sign out</button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-black/70 mt-2 leading-relaxed">
                  The current 72-hour situation picture is free. Analyst access adds the 7D,
                  30D, and full issue archive plus facts-only drafting over published data.
                </p>
                {gate.signedIn ? (
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      onClick={() => claimFree("monthly")}
                      disabled={checkoutBusy || !prices}
                      className="bg-[#171712] text-white text-sm font-semibold py-2.5 hover:bg-[#0b0b3b] disabled:opacity-50"
                    >
                      {checkoutBusy ? "Continuing…" : !prices ? "Loading price…" : `Continue — ${monthlyLabel}`}
                    </button>
                    <button
                      onClick={() => claimFree("annual")}
                      disabled={checkoutBusy || !prices}
                      className="border border-[#171712] text-[#171712] text-sm font-semibold py-2.5 hover:bg-[#eae4d2] disabled:opacity-50"
                    >
                      {!prices ? "Loading annual price…" : `Continue — ${annualLabel}`}
                    </button>
                    <p className="text-[11px] leading-relaxed text-[#6b675c]">
                      Select the plan you would use for Analyst access. No payment details are collected on this screen.
                    </p>
                    {checkoutError && <p className="font-mono text-[10px] text-[#8a2f2f]">{checkoutError}</p>}
                    <div className="font-mono text-[10px] text-[#6b675c] mt-2">
                      Signed in as {gate.email} ·{" "}
                      <form action="/auth/signout" method="post" className="inline">
                        <button type="submit" className="underline hover:text-[#8a6100]">sign out</button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <a
                    href="/signin?next=/analyst"
                    className="mt-5 inline-block bg-[#171712] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#0b0b3b]"
                  >
                    Create account or sign in
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {betaReveal && (
              <div role="status" className="border border-[#1f4a2e] bg-[#edf3e9] px-5 py-4">
                <p className="headline text-xl text-[#1f4a2e]">Beta access unlocked</p>
                <p className="mt-2 text-sm leading-relaxed text-[#3d493b]">
                  You selected {betaReveal.label}. While Theater Picture is in beta, Analyst access is free.
                  No card was collected and you were not charged. Paid access will require a separate opt-in when beta ends.
                </p>
              </div>
            )}
            {messages.length === 0 && (
              <div className="border border-[#c9c2ac] rounded-md p-5 bg-[#efeadb]">
                <p className="text-sm text-black/70 leading-relaxed">
                  Ask for report text over the published theater data. Drafts summarize reported
                  facts with sourcing caveats and cite event numbers — they carry no analytic
                  judgement (that publishes only over a named analyst&apos;s signature) and are
                  never part of the published record.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left font-mono text-xs px-3 py-2 rounded-md border border-[#c9c2ac] hover:border-[#8f8a7c] hover:bg-[#eae4d2]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-md bg-[#171712] text-white px-4 py-2.5 text-sm whitespace-pre-wrap"
                      : "max-w-full rounded-md border border-[#c9c2ac] bg-[#f5f2ea] px-4 py-3"
                  }
                >
                  {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {busy && (
              <p className="font-mono text-xs text-[#6b675c]" role="status" aria-live="polite">
                Drafting from published issues… {elapsedSeconds}s
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className="border-t border-[#c9c2ac] bg-[#efeadb] shrink-0">
        <form
          className="max-w-3xl mx-auto px-4 py-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!gate.active}
            placeholder={
              gate.active
                ? "Ask for a facts-only draft covering the theaters you care about…"
                : "Subscribe to use the drafting workspace"
            }
            className="flex-1 border border-black/20 rounded-md px-3 py-2 text-sm bg-[#f5f2ea] focus:outline-none focus:border-[#171712] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !gate.active}
            className="font-mono text-xs px-4 py-2 rounded-md bg-[#171712] text-white disabled:opacity-50 hover:bg-[#3a382e]"
          >
            DRAFT
          </button>
        </form>
      </div>
    </div>
  );
}
