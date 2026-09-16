"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Affiliation, EventCategory, TheaterEvent } from "@intel-os/core";
import type { IssueRow } from "@/lib/db";
import { applyView, decodeView, DEFAULT_VIEW, encodeView, type ViewState } from "@/lib/urlState";
import TheaterMap from "./TheaterMap";
import EventDetail from "./EventDetail";

const WINDOW_PRESETS: { label: string; hours: number | null }[] = [
  { label: "72H", hours: 72 },
  { label: "7D", hours: 24 * 7 },
  { label: "30D", hours: 24 * 30 },
  { label: "ALL", hours: null },
];

const AFF_META: { key: Affiliation; label: string; dot: string }[] = [
  { key: "hostile", label: "HOSTILE", dot: "bg-[#ff3031]" },
  { key: "friendly", label: "FRIENDLY", dot: "bg-[#00a8dc]" },
  { key: "neutral", label: "NEUTRAL", dot: "bg-[#00e200]" },
  { key: "unknown", label: "UNKNOWN", dot: "bg-[#ffff00]" },
];

const CATS: EventCategory[] = ["strike", "ground", "maritime", "infrastructure", "air-defense", "movement", "political", "other"];

export function zulu(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z ${d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase()} ${String(d.getUTCFullYear()).slice(2)}`;
}

export default function TheaterView({ issue }: { issue: IssueRow }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewState>(() => decodeView(new URLSearchParams(searchParams.toString())));
  const viewRef = useRef(view);
  viewRef.current = view;

  // UX-2: filter/date state round-trips through the URL
  const updateView = useCallback(
    (patch: Partial<ViewState>) => {
      const next = { ...viewRef.current, ...patch };
      setView(next);
      const qs = encodeView(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    setView(decodeView(new URLSearchParams(searchParams.toString())));
  }, [searchParams]);

  const events: TheaterEvent[] = issue.snapshot ?? [];
  const filtered = useMemo(
    () => applyView(events, view, issue.info_cutoff),
    [events, view, issue.info_cutoff],
  );
  const plottable = filtered.filter((e) => e.lat != null && e.lon != null);
  const unplotted = filtered.filter((e) => e.lat == null || e.lon == null);
  const selected = filtered.find((e) => e.id === view.selectedEvent) ?? null;

  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Masthead — UX-4: information cut-off stated prominently at all times */}
      <header className="border-b border-[#30363d] px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 bg-[#161b22] shrink-0">
        <a href="/" className="font-sans text-sm font-semibold text-[#8b949e] hover:text-[#4493f8]">
          ◂ Theater Picture
        </a>
        <span className="headline text-base text-[#e6edf3]">{issue.aor}</span>
        <a
          href={`/t/${issue.aor.toLowerCase()}/history`}
          className="font-mono text-xs text-[#8b949e] hover:text-[#e6edf3]"
          title="Issue archive"
        >
          {issue.serial} · situation update · unattended, no judgement layer
        </a>
        <span className="font-mono text-xs text-amber-300 ml-auto">
          INFO CUT-OFF {zulu(issue.info_cutoff)}
        </span>
      </header>

      {/* Controls */}
      <div className="border-b border-[#30363d] px-4 py-2 flex flex-wrap items-center gap-2 bg-[#0d1117] text-[11px] font-mono shrink-0">
        <div className="flex gap-1">
          {WINDOW_PRESETS.map((w) => (
            <button
              key={w.label}
              onClick={() => updateView({ windowHours: w.hours })}
              className={`px-2 py-0.5 rounded-md border ${
                view.windowHours === w.hours
                  ? "border-amber-400 text-amber-300"
                  : "bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:border-[#8b949e]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <span className="text-[#30363d]">|</span>
        <div className="flex gap-1">
          {AFF_META.map((a) => {
            const active = view.affiliations.length === 0 || view.affiliations.includes(a.key);
            return (
              <button
                key={a.key}
                onClick={() => updateView({ affiliations: toggle(view.affiliations, a.key) })}
                className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                  active ? "bg-[#21262d] border-[#8b949e] text-[#e6edf3]" : "bg-[#161b22] border-[#30363d] text-[#6e7681]"
                }`}
                title={view.affiliations.length === 0 ? "showing all; click to filter" : undefined}
              >
                <span className={`inline-block w-2 h-2 ${a.dot} ${active ? "" : "opacity-30"}`} />
                {a.label}
              </button>
            );
          })}
        </div>
        <span className="text-[#30363d]">|</span>
        <select
          value={view.categories[0] ?? ""}
          onChange={(e) =>
            updateView({ categories: e.target.value ? [e.target.value as EventCategory] : [] })
          }
          className="bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1 text-[#e6edf3]"
        >
          <option value="">ALL CATEGORIES</option>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>
        <button
          onClick={() => updateView({ usOnly: !view.usOnly })}
          className={`px-2 py-0.5 rounded-md border ${
            view.usOnly ? "border-amber-400 text-amber-300" : "bg-[#21262d] border-[#30363d] text-[#c9d1d9]"
          }`}
        >
          US FORCES
        </button>
        <select
          value={view.confidenceFloor}
          onChange={(e) => updateView({ confidenceFloor: e.target.value as ViewState["confidenceFloor"] })}
          className="bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1 text-[#e6edf3]"
          title="Confidence floor (origin confidence)"
        >
          <option value="low">CONF ≥ LOW</option>
          <option value="moderate">CONF ≥ MOD</option>
          <option value="high">CONF ≥ HIGH</option>
        </select>
        <span className="ml-auto text-[#8b949e]">
          {filtered.length} events · {plottable.length} plotted
          {unplotted.length > 0 && ` · ${unplotted.length} listed without position`}
        </span>
      </div>

      {/* Main split */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div className="flex-1 min-h-[320px] relative">
          <TheaterMap
            events={plottable}
            selectedId={view.selectedEvent}
            onSelect={(id) => updateView({ selectedEvent: id })}
          />
        </div>

        {/* Event list — synced with the map from the same view state (UX-1) */}
        <aside className="md:w-96 md:border-l border-t md:border-t-0 border-[#30363d] bg-[#161b22] flex flex-col min-h-0 max-h-[45dvh] md:max-h-none">
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <p className="p-4 text-xs font-mono text-[#8b949e]">
                No events match the current filters within this window.
              </p>
            )}
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => updateView({ selectedEvent: e.id === view.selectedEvent ? null : e.id })}
                className={`group w-full text-left px-4 py-3 border-b border-[#21262d] hover:bg-[#1c2128] ${
                  e.id === view.selectedEvent ? "bg-[#1c2a3a]" : ""
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={`shrink-0 inline-block w-2 h-2 rounded-none rotate-45 ${
                      e.affiliation === "hostile"
                        ? "bg-[#ff3031]"
                        : e.affiliation === "friendly"
                          ? "bg-[#00a8dc]"
                          : e.affiliation === "neutral"
                            ? "bg-[#00e200]"
                            : "bg-[#ffff00]"
                    }`}
                  />
                  <span className="font-sans text-sm font-semibold leading-snug text-[#e6edf3] group-hover:text-[#4493f8]">{e.title}</span>
                </div>
                <div className="font-mono text-[10px] text-[#6e7681] mt-1 flex gap-3">
                  <span>{zulu(e.occurredAt)}</span>
                  <span>{e.placeName.toUpperCase()}</span>
                  {(e.lat == null || e.lon == null) && <span className="text-amber-400">NO POSITION</span>}
                  {e.usForcesFlag && <span className="text-amber-300">US</span>}
                </div>
              </button>
            ))}
          </div>
          {selected && <EventDetail event={selected} onClose={() => updateView({ selectedEvent: null })} />}
        </aside>
      </div>

      {/* Sourcing statement footer */}
      <footer className="border-t border-[#30363d] px-4 py-1.5 bg-[#0d1117] shrink-0">
        <p className="font-mono text-[10px] text-[#6e7681] truncate" title={issue.source_summary?.statement}>
          {issue.source_summary?.statement}
        </p>
      </footer>
    </div>
  );
}
