"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Affiliation, EventCategory } from "@intel-os/core";
import { IDENTITY_COLOR_LIGHT } from "@intel-os/core";
import type { IssueRow } from "@/lib/db";
import { applyView, decodeView, encodeView, type ViewState } from "@/lib/urlState";
import TheaterMap, { type NumberedEvent } from "./TheaterMap";
import EventCallout from "./EventDetail";

const WINDOW_PRESETS: { label: string; hours: number | null }[] = [
  { label: "72H", hours: 72 },
  { label: "7D", hours: 24 * 7 },
  { label: "30D", hours: 24 * 30 },
  { label: "ALL", hours: null },
];

// hex = dark accent for text/spines; fill = the exact MIL-STD-2525 light fill
// milsymbol paints on the map (Table XV light set) so the legend matches the symbols.
export const AFF_META: { key: Affiliation; label: string; hex: string; fill: string }[] = [
  { key: "hostile", label: "Hostile action", hex: "#a02c2c", fill: IDENTITY_COLOR_LIGHT.hostile },
  { key: "friendly", label: "Friendly action", hex: "#1f4e79", fill: IDENTITY_COLOR_LIGHT.friendly },
  { key: "neutral", label: "Neutral", hex: "#1f4a2e", fill: IDENTITY_COLOR_LIGHT.neutral },
  { key: "unknown", label: "Unknown / contested", hex: "#b08800", fill: IDENTITY_COLOR_LIGHT.unknown },
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

  // Chronological serials over the whole issue snapshot (oldest = 1) — stable
  // regardless of active filters; proof-build numbering convention.
  const events: NumberedEvent[] = useMemo(() => {
    const asc = [...(issue.snapshot ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const nums = new Map(asc.map((e, i) => [e.id, i + 1]));
    return (issue.snapshot ?? []).map((e) => ({ ...e, num: nums.get(e.id)! }));
  }, [issue.snapshot]);

  const filtered = useMemo(
    () => applyView(events, view, issue.info_cutoff).sort((a, b) => b.num - a.num),
    [events, view, issue.info_cutoff],
  );
  const eventListRef = useRef<HTMLDivElement>(null);
  const eventRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const plottable = filtered.filter((e) => e.lat != null && e.lon != null);
  const unplotted = filtered.filter((e) => e.lat == null || e.lon == null);
  const selected = filtered.find((e) => e.id === view.selectedEvent) ?? null;

  // Keep map/keyboard selections synchronized with the event index without
  // moving browser focus or scrolling the whole page.
  useEffect(() => {
    if (!view.selectedEvent) return;

    const frame = window.requestAnimationFrame(() => {
      const list = eventListRef.current;
      const row = eventRowRefs.current.get(view.selectedEvent!);
      if (!list || !row) return;

      const listRect = list.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const rowIsVisible = rowRect.top >= listRect.top && rowRect.bottom <= listRect.bottom;
      if (rowIsVisible) return;

      const centeredTop =
        list.scrollTop +
        (rowRect.top - listRect.top) -
        (list.clientHeight - rowRect.height) / 2;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      list.scrollTo({
        top: Math.max(0, centeredTop),
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filtered, view.selectedEvent]);

  // prev/next step through the filtered set in chronological order
  const chrono = useMemo(() => [...filtered].sort((a, b) => a.num - b.num), [filtered]);
  const selIdx = selected ? chrono.findIndex((e) => e.id === selected.id) : -1;
  const step = (d: -1 | 1) => {
    if (chrono.length === 0) return;
    const next = selIdx < 0 ? chrono[0] : chrono[(selIdx + d + chrono.length) % chrono.length];
    updateView({ selectedEvent: next.id });
  };

  const toggleAff = (a: Affiliation) =>
    updateView({
      affiliations: view.affiliations.includes(a)
        ? view.affiliations.filter((x) => x !== a)
        : [...view.affiliations, a],
    });

  const secondaryActive =
    view.categories.length > 0 || view.usOnly || view.confidenceFloor !== "low";

  const affColor = (a: Affiliation) => AFF_META.find((m) => m.key === a)?.hex ?? "#171712";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Masthead — UX-4: info cut-off always visible */}
      <header className="border-b-2 border-[#171712] px-5 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 bg-[#f5f2ea] shrink-0">
        <a href="/" className="font-mono text-[11px] tracking-widest text-[#6b675c] hover:text-[#a02c2c]">
          ◂ THEATER PICTURE
        </a>
        <span className="headline text-2xl">{issue.aor}</span>
        <a
          href={`/t/${issue.aor.toLowerCase()}/history`}
          className="font-mono text-[11px] text-[#6b675c] hover:text-[#171712]"
          title="Issue archive"
        >
          {issue.serial} · situation update
        </a>
        <span className="font-mono text-[11px] text-[#8a6100] ml-auto">
          INFO CUT-OFF {zulu(issue.info_cutoff)}
        </span>
        <a
          href={`/t/${issue.aor.toLowerCase()}/report${typeof window !== "undefined" && window.location.search ? window.location.search : ""}`}
          className="font-mono text-[11px] px-3 py-1.5 bg-[#171712] text-[#f5f2ea] hover:bg-[#3a382e]"
        >
          GENERATE REPORT
        </a>
      </header>

      {/* One thin control bar: time window · filter menu · count */}
      <div className="border-b border-[#c9c2ac] px-5 py-1.5 flex items-center gap-2 bg-[#efeadb] text-[11px] font-mono shrink-0">
        {WINDOW_PRESETS.map((w) => (
          <button
            key={w.label}
            onClick={() => updateView({ windowHours: w.hours })}
            className={`px-2.5 py-1 border ${
              view.windowHours === w.hours
                ? "border-[#171712] bg-[#171712] text-[#f5f2ea]"
                : "border-[#c9c2ac] text-[#6b675c] hover:border-[#6b675c]"
            }`}
          >
            {w.label}
          </button>
        ))}
        <details className="relative">
          <summary
            className={`list-none cursor-pointer px-2.5 py-1 border select-none ${
              secondaryActive ? "border-[#8a6100] text-[#8a6100]" : "border-[#c9c2ac] text-[#6b675c] hover:border-[#6b675c]"
            }`}
          >
            FILTERS {secondaryActive ? "●" : "▾"}
          </summary>
          <div className="absolute z-20 mt-1 w-64 bg-[#f5f2ea] border border-[#171712] shadow-lg p-3 space-y-3">
            <div>
              <div className="text-[10px] tracking-widest text-[#918c7d] mb-1">CATEGORY</div>
              <select
                value={view.categories[0] ?? ""}
                onChange={(e) => updateView({ categories: e.target.value ? [e.target.value as EventCategory] : [] })}
                className="w-full bg-[#efeadb] border border-[#c9c2ac] px-2 py-1"
              >
                <option value="">All categories</option>
                {CATS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-[#918c7d] mb-1">CONFIDENCE FLOOR</div>
              <select
                value={view.confidenceFloor}
                onChange={(e) => updateView({ confidenceFloor: e.target.value as ViewState["confidenceFloor"] })}
                className="w-full bg-[#efeadb] border border-[#c9c2ac] px-2 py-1"
              >
                <option value="low">Show all confidence</option>
                <option value="moderate">Moderate and above</option>
                <option value="high">High only</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={view.usOnly} onChange={() => updateView({ usOnly: !view.usOnly })} />
              <span>US forces affected only</span>
            </label>
          </div>
        </details>
        <span className="ml-auto text-[#6b675c]">
          {filtered.length} events · {plottable.length} plotted
          {unplotted.length > 0 && ` · ${unplotted.length} unplotted`}
        </span>
      </div>

      {/* Main split */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Map + legend + selection callout */}
        <div className="flex-1 min-h-[340px] relative">
          <TheaterMap
            events={plottable}
            referenceEvents={filtered}
            selectedId={view.selectedEvent}
            onSelect={(id) => updateView({ selectedEvent: id })}
          />

          {/* LEGEND doubles as the affiliation filter (proof-build block) */}
          <div className="absolute top-3 right-3 z-10 bg-[#f5f2ea]/95 border border-[#171712] px-3 py-2">
            <div className="font-mono text-[9px] tracking-[0.2em] text-[#6b675c] mb-1.5">LEGEND · CLICK TO FILTER</div>
            {AFF_META.map((a) => {
              const active = view.affiliations.length === 0 || view.affiliations.includes(a.key);
              return (
                <button
                  key={a.key}
                  onClick={() => toggleAff(a.key)}
                  className={`flex items-center gap-2 font-mono text-[10px] py-0.5 w-full text-left ${
                    active ? "text-[#171712]" : "text-[#b7b1a0] line-through"
                  }`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rotate-45"
                    style={{
                      backgroundColor: active ? a.fill : "transparent",
                      border: "1.5px solid rgba(10,14,18,0.9)",
                      opacity: active ? 1 : 0.4,
                    }}
                  />
                  {a.label}
                </button>
              );
            })}
            <div className="mt-2 border-t border-[#c9c2ac] pt-2 font-mono text-[9px] text-[#514d43]">
              <div className="flex items-center gap-2 py-0.5">
                <span className="w-7 border-t-[2px] border-dashed border-[#8a6100]" />
                Mapped pipeline
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="w-7 border-t-[2px] border-dashed border-[#1f4e79]" />
                Shipping-network route
              </div>
              {(
                [
                  ["#1f4e79", "Airfield / air base"],
                  ["#2f7d8a", "Port / naval facility"],
                  ["#8a6100", "Energy site"],
                  ["#6b675c", "City"],
                ] as const
              ).map(([color, label]) => (
                <div key={label} className="flex items-center gap-2 py-0.5">
                  <span className="w-7 flex justify-center">
                    <span
                      className="inline-block w-[9px] h-[9px] rounded-full border border-[#f5f2ea]"
                      style={{ backgroundColor: color, opacity: 0.7 }}
                    />
                  </span>
                  {label}
                </div>
              ))}
              <p className="mt-1 max-w-[190px] leading-snug text-[#6b675c]">
                Lines and sites appear when an event names them or occurs nearby. Hover
                for detail.
              </p>
              {issue.aor === "EUCOM" && (
                <div className="mt-2 border-t border-[#c9c2ac] pt-2">
                  <div className="flex items-center gap-2 py-0.5">
                    <span
                      className="inline-block w-4 h-3 border"
                      style={{ backgroundColor: "rgba(125,135,148,0.25)", borderColor: "rgba(125,135,148,0.7)" }}
                    />
                    NATO member state
                  </div>
                  <p className="mt-1 max-w-[190px] leading-snug text-[#6b675c]">
                    Political context (alliance membership) — not an event affiliation.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Selection callout — proof-build card docked over the map */}
          {selected && (
            <EventCallout
              event={selected}
              color={affColor(selected.affiliation)}
              fill={AFF_META.find((m) => m.key === selected.affiliation)?.fill ?? "#f5f2ea"}
              onClose={() => updateView({ selectedEvent: null })}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
            />
          )}
        </div>

        {/* Event index — one line each, calm */}
        <aside className="md:w-[340px] md:border-l border-t md:border-t-0 border-[#c9c2ac] bg-[#f5f2ea] flex flex-col min-h-0 max-h-[40dvh] md:max-h-none">
          <div className="px-4 py-2 border-b border-[#e3ddcc] font-mono text-[9px] tracking-[0.2em] text-[#918c7d] shrink-0">
            EVENT INDEX · NEWEST FIRST
          </div>
          <div ref={eventListRef} className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <p className="p-4 text-xs font-mono text-[#6b675c]">No events match the current filters.</p>
            )}
            {filtered.map((e) => {
              const isSel = e.id === view.selectedEvent;
              return (
                <button
                  key={e.id}
                  ref={(node) => {
                    if (node) eventRowRefs.current.set(e.id, node);
                    else eventRowRefs.current.delete(e.id);
                  }}
                  onClick={() => updateView({ selectedEvent: isSel ? null : e.id })}
                  aria-current={isSel ? "true" : undefined}
                  className={`w-full text-left pl-3 pr-4 py-2.5 border-b border-[#e3ddcc] border-l-[3px] transition-colors ${
                    isSel ? "bg-[#ece5d0]" : "border-l-transparent hover:bg-[#efeadb]"
                  }`}
                  style={isSel ? { borderLeftColor: affColor(e.affiliation) } : undefined}
                >
                  <div className="flex items-baseline gap-2.5">
                    <span
                      className="shrink-0 font-mono text-[10px] font-bold w-5 text-center"
                      style={{ color: affColor(e.affiliation) }}
                    >
                      {e.num}
                    </span>
                    <span className="font-sans text-[13px] font-medium leading-snug">{e.title}</span>
                  </div>
                  <div className="font-mono text-[9px] text-[#918c7d] mt-1 pl-[30px] flex gap-2.5">
                    <span>{zulu(e.occurredAt)}</span>
                    <span>{e.placeName.toUpperCase()}</span>
                    {(e.lat == null || e.lon == null) && <span className="text-[#8a6100]">UNPLOTTED</span>}
                    {e.usForcesFlag && <span className="text-[#a02c2c]">US</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Sourcing + symbology statements */}
      <footer className="border-t border-[#c9c2ac] px-5 py-1.5 bg-[#efeadb] shrink-0">
        <p className="font-mono text-[9px] text-[#918c7d] truncate" title={issue.source_summary?.statement}>
          {issue.source_summary?.statement}
        </p>
        <p className="font-mono text-[9px] text-[#918c7d]">
          Symbology: MIL-STD-2525E affiliation frames carrying the event serial (the Activities set defines no icons for conventional operations).
          Dashed frames mark region-level precision; closely co-located symbols are slightly displaced for legibility.
        </p>
      </footer>
    </div>
  );
}
