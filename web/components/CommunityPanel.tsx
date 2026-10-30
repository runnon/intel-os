"use client";

import { useEffect, useRef, useState } from "react";
import { COMMUNITY_COLOR, type CommunityReport } from "@/lib/community";

// "3h ago" / "2d ago" — community rows are scanned by recency, not by DTG.
function ago(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// <input type="datetime-local"> wants local wall-clock time without a zone.
function localInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const field = "mt-1 w-full border border-[#c9c2ac] bg-white px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-[#171712]";
const label = "block text-[10px] font-mono tracking-wider text-[#514d43]";

// Community reports for one theater: events sent in by signed-in users with a public
// source link. Clearly unverified, on their own map layer, never in the situation update.
export default function CommunityPanel({
  aor,
  reports,
  loading,
  loadError,
  selectedId,
  onSelect,
  onChanged,
  startWithForm = false,
}: {
  aor: string;
  reports: CommunityReport[];
  loading: boolean;
  loadError: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChanged: (selectId?: string) => void;
  startWithForm?: boolean;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [formOpen, setFormOpen] = useState(startWithForm);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    let live = true;
    fetch("/api/entitlement", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => live && setSignedIn(!!d.signedIn))
      .catch(() => live && setSignedIn(false));
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, []);

  // A dot picked on the map scrolls its row into view.
  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  async function flag(id: string) {
    setRowError(null);
    const res = await fetch("/api/community/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setRowError({ id, text: d.error ?? "Couldn't flag the report." });
    onChanged();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete your report? This can't be undone.")) return;
    setRowError(null);
    const res = await fetch(`/api/community?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setRowError({ id, text: d.error ?? "Couldn't delete the report." });
    onSelect(null);
    onChanged();
  }

  const signInHref = () => {
    const path = typeof window !== "undefined" ? window.location.pathname : `/t/${aor.toLowerCase()}`;
    return `/signin?next=${encodeURIComponent(`${path}?tab=submit`)}`;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-2 border-b border-[#e3ddcc] shrink-0 bg-[#f1ebf5]">
        <p className="font-mono text-[9px] tracking-[0.2em]" style={{ color: COMMUNITY_COLOR }}>
          UNVERIFIED · COMMUNITY REPORTS
        </p>
        <p className="text-[11px] leading-snug text-[#514d43] mt-0.5">
          Sent in by signed-in users, each with a public source link. Not checked by Theater Picture and never part of
          the situation update. Open the source before you rely on it.
        </p>
      </div>

      {/* Form and list share one scroll area so an open form never hides the list. */}
      <div className="overflow-y-auto flex-1">
      <div className="px-4 py-2 border-b border-[#e3ddcc]">
        {formOpen && signedIn ? (
          <SubmitForm
            aor={aor}
            onCancel={() => setFormOpen(false)}
            onDone={(id, message) => {
              setFormOpen(false);
              setNotice(message);
              onChanged(id);
            }}
          />
        ) : signedIn === false ? (
          <div className="flex items-center gap-3">
            <a
              href={signInHref()}
              className="font-mono text-[10px] px-3 py-1.5 text-white hover:opacity-90"
              style={{ backgroundColor: COMMUNITY_COLOR }}
            >
              SIGN IN FREE TO SUBMIT
            </a>
            <span className="text-[11px] text-[#6b675c]">Email link, no password.</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setNotice(null);
              setFormOpen(true);
            }}
            disabled={signedIn === null}
            className="font-mono text-[10px] px-3 py-1.5 text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: COMMUNITY_COLOR }}
          >
            + SUBMIT A REPORT
          </button>
        )}
        {notice && !formOpen && (
          <p role="status" className="mt-2 text-[11px] leading-snug text-[#1f4a2e]">
            {notice}
          </p>
        )}
      </div>

      <ul>
        {loading && reports.length === 0 && (
          <li className="p-4 text-xs font-mono text-[#6b675c]">Loading community reports…</li>
        )}
        {loadError && <li className="p-4 text-xs text-[#a02c2c]">{loadError}</li>}
        {!loading && !loadError && reports.length === 0 && (
          <li className="p-4 text-[12px] leading-snug text-[#6b675c]">
            No community reports for {aor} in the last 30 days. Seen something in public reporting that isn&apos;t on
            the map? Send it in.
          </li>
        )}
        {reports.map((r) => {
          const isSel = r.id === selectedId;
          return (
            <li
              key={r.id}
              ref={(node) => {
                if (node) rowRefs.current.set(r.id, node);
                else rowRefs.current.delete(r.id);
              }}
              className={`border-b border-[#e3ddcc] border-l-[3px] ${isSel ? "bg-[#f1ebf5]" : "border-l-transparent"}`}
              style={isSel ? { borderLeftColor: COMMUNITY_COLOR } : undefined}
            >
              <button
                onClick={() => onSelect(isSel ? null : r.id)}
                aria-expanded={isSel}
                className="w-full text-left pl-3 pr-4 pt-2.5 pb-2 hover:bg-[#f6f1f8]"
              >
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="shrink-0 inline-block w-2 h-2 rounded-full translate-y-[-1px]"
                    style={{ backgroundColor: r.lat == null ? "transparent" : COMMUNITY_COLOR, border: `1.5px solid ${COMMUNITY_COLOR}` }}
                    aria-hidden
                  />
                  <span className="font-sans text-[13px] font-medium leading-snug">{r.title}</span>
                </div>
                <div className="font-mono text-[9px] text-[#918c7d] mt-1 pl-[18px] flex flex-wrap gap-x-2.5">
                  <span>{now ? ago(r.occurredAt, now) : ""}</span>
                  <span>{r.placeName.toUpperCase()}</span>
                  {r.lat == null && <span className="text-[#8a6100]">NOT ON MAP</span>}
                  {r.mine && <span style={{ color: COMMUNITY_COLOR }}>YOURS</span>}
                </div>
              </button>
              {isSel && (
                <div className="pl-[30px] pr-4 pb-3 space-y-2">
                  {r.summary && <p className="text-[12px] leading-relaxed whitespace-pre-line">{r.summary}</p>}
                  <p className="text-[11px]">
                    Source:{" "}
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="underline hover:text-[#171712]"
                      style={{ color: COMMUNITY_COLOR }}
                    >
                      {r.sourceHost || "link"} ↗
                    </a>
                  </p>
                  <p className="font-mono text-[9px] text-[#918c7d]">
                    Happened {new Date(r.occurredAt).toUTCString().replace(" GMT", " UTC")}
                    {r.country ? ` · ${r.country}` : ""}
                    {r.lat != null && r.precision === "region" ? " · plotted at the area's reference point" : ""}
                  </p>
                  <div className="flex gap-3 font-mono text-[10px]">
                    {r.mine ? (
                      <button onClick={() => void remove(r.id)} className="underline text-[#a02c2c]">
                        Delete my report
                      </button>
                    ) : signedIn && !r.flagged ? (
                      <button onClick={() => void flag(r.id)} className="underline text-[#6b675c] hover:text-[#a02c2c]">
                        Flag as wrong or spam
                      </button>
                    ) : r.flagged ? (
                      <span className="text-[#6b675c]">You flagged this</span>
                    ) : null}
                  </div>
                  {rowError?.id === r.id && <p className="text-[11px] text-[#a02c2c]">{rowError.text}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}

function SubmitForm({
  aor,
  onCancel,
  onDone,
}: {
  aor: string;
  onCancel: () => void;
  onDone: (id: string, message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [country, setCountry] = useState("");
  const [when, setWhen] = useState(() => localInputValue(new Date()));
  const [sourceUrl, setSourceUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const at = new Date(when);
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aor,
          title,
          summary,
          placeName,
          country,
          occurredAt: Number.isNaN(at.getTime()) ? "" : at.toISOString(),
          sourceUrl,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ text: d.error ?? "Couldn't submit the report. Try again.", field: d.field });
        return;
      }
      onDone(
        d.id,
        d.plottedAt
          ? `Posted to the community layer, plotted at ${d.plottedAt}.`
          : `Posted to the community layer. "${placeName}" didn't match a known place, so it's listed without a map point.`,
      );
    } catch {
      setError({ text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const bad = (f: string) => (error?.field === f ? " border-[#a02c2c]" : "");

  return (
    <form onSubmit={submit} className="space-y-2 py-1" aria-label={`Submit a community report for ${aor}`}>
      <label className={label}>
        HEADLINE
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={8}
          maxLength={140}
          autoFocus
          placeholder="e.g. Explosions reported near the port"
          className={field + bad("title")}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          WHERE
          <input
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            required
            maxLength={120}
            placeholder="City, base, or area"
            className={field + bad("placeName")}
          />
        </label>
        <label className={label}>
          COUNTRY
          <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} className={field + bad("country")} />
        </label>
      </div>
      <label className={label}>
        WHEN (YOUR LOCAL TIME)
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
          className={field + bad("occurredAt")}
        />
      </label>
      <label className={label}>
        PUBLIC SOURCE LINK
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          required
          maxLength={2000}
          placeholder="https://"
          className={field + bad("sourceUrl")}
        />
      </label>
      <label className={label}>
        WHAT HAPPENED (OPTIONAL)
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="What the source reports, in your own words."
          className={field + " resize-y" + bad("summary")}
        />
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-snug text-[#514d43]">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
        <span>This comes from a public source, and contains no classified, leaked, or private personal information.</span>
      </label>
      {error && (
        <p role="alert" className="text-[11px] text-[#a02c2c]">
          {error.text}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy || !confirmed}
          className="font-mono text-[10px] px-3 py-1.5 text-white disabled:opacity-40"
          style={{ backgroundColor: COMMUNITY_COLOR }}
        >
          {busy ? "SUBMITTING…" : "SUBMIT"}
        </button>
        <button type="button" onClick={onCancel} className="font-mono text-[10px] underline text-[#6b675c]">
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-[#918c7d] leading-snug">
        Appears right away on the community layer for {aor}, without your name or email. Three flags from other users
        hide a report.
      </p>
    </form>
  );
}
