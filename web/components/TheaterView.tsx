"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Affiliation, EventCategory } from "@intel-os/core";
import { IDENTITY_COLOR_LIGHT } from "@intel-os/core";
import type { IssueRow } from "@/lib/db";
import { applyView, decodeView, encodeView, type ViewState } from "@/lib/urlState";
import { ageLabel, plainUtc } from "@/lib/age";
import { REGIONS, regionName } from "@/lib/regions";
import { CATEGORY_PLAIN } from "@/lib/plain";
import When from "./When";
import MapKey from "./MapKey";
import TheaterMap, { type CommunityPoint, type NumberedEvent } from "./TheaterMap";
import EventCallout from "./EventDetail";
import AskPanel from "./AskPanel";
import AccountLink from "./AccountLink";
import StackList from "./StackList";
import CommunityPanel from "./CommunityPanel";
import { COMMUNITY_COLOR, type CommunityReport } from "@/lib/community";

// An issue holds 30 days of events, so "30 days" is the whole window (w=all).
const WINDOW_PRESETS: { label: string; hours: number | null }[] = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: null },
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

export default function TheaterView({
  issue,
  reportHref,
  allTheaters = false,
}: {
  issue: IssueRow;
  reportHref?: string;
  allTheaters?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewState>(() => decodeView(new URLSearchParams(searchParams.toString())));
  // Sidebar tab; ?tab=ask / ?tab=submit survive the sign-in round trip.
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<"index" | "community" | "ask">(() =>
    allTheaters ? "index" : initialTab === "ask" ? "ask" : initialTab === "submit" || initialTab === "community" ? "community" : "index",
  );
  // Community layer: OFF by default; turned on by its toggle or by opening its tab.
  const [communityOn, setCommunityOn] = useState(tab === "community");
  const [community, setCommunity] = useState<CommunityReport[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communitySel, setCommunitySel] = useState<string | null>(null);
  const [communityNonce, setCommunityNonce] = useState(0);
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

  // Cut-off age is clock-dependent, so it renders only after mount (no hydration
  // mismatch) and ticks each minute.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

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

  // Events sharing one map position, opened as a list (newest first). Filters
  // still apply; the list closes itself when nothing in it survives them.
  const [stackIds, setStackIds] = useState<string[] | null>(null);
  const stackEvents = useMemo(
    () => (stackIds ? filtered.filter((e) => stackIds.includes(e.id)).sort((a, b) => b.num - a.num) : []),
    [filtered, stackIds],
  );
  const inStack = selected != null && stackEvents.some((e) => e.id === selected.id);

  // prev/next step chronologically — within the location list when the event was
  // opened from one, otherwise through the whole filtered set
  const chrono = useMemo(
    () => [...(inStack ? stackEvents : filtered)].sort((a, b) => a.num - b.num),
    [filtered, stackEvents, inStack],
  );
  const selIdx = selected ? chrono.findIndex((e) => e.id === selected.id) : -1;
  const step = (d: -1 | 1) => {
    if (chrono.length === 0) return;
    const next = selIdx < 0 ? chrono[0] : chrono[(selIdx + d + chrono.length) % chrono.length];
    updateView({ selectedEvent: next.id });
  };

  // Key rows hide/show one kind. An empty list means "all shown", so the first tap hides
  // that kind; showing every kind again collapses back to the empty list. The last kind
  // left can't be hidden (an empty map would read as "nothing happened").
  const ALL_AFFS: Affiliation[] = ["hostile", "friendly", "neutral", "unknown"];
  const toggleAff = (a: Affiliation) => {
    const shown = view.affiliations.length === 0 ? ALL_AFFS : view.affiliations;
    const next = shown.includes(a) ? shown.filter((x) => x !== a) : [...shown, a];
    if (next.length === 0) return;
    updateView({ affiliations: next.length === ALL_AFFS.length ? [] : ALL_AFFS.filter((x) => next.includes(x)) });
  };

  const secondaryActive =
    view.categories.length > 0 || view.usOnly || view.confidenceFloor !== "low";

  // Fetch community reports only while the layer is on (never for "All theaters").
  useEffect(() => {
    if (!communityOn || allTheaters) return;
    let live = true;
    setCommunityLoading(true);
    setCommunityError(null);
    fetch(`/api/community?aor=${issue.aor}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Couldn't load community reports.");
        if (live) setCommunity(d.reports ?? []);
      })
      .catch((e) => live && setCommunityError(e instanceof Error ? e.message : "Couldn't load community reports."))
      .finally(() => live && setCommunityLoading(false));
    return () => {
      live = false;
    };
  }, [communityOn, allTheaters, issue.aor, communityNonce]);

  const communityPoints: CommunityPoint[] = useMemo(
    () =>
      communityOn
        ? community
            .filter((r) => r.lat != null && r.lon != null)
            .map((r) => ({ id: r.id, lat: r.lat!, lon: r.lon!, title: r.title, placeName: r.placeName, precision: r.precision }))
        : [],
    [community, communityOn],
  );

  const openCommunity = (id: string | null) => {
    setCommunityOn(true);
    setTab("community");
    setCommunitySel(id);
    // on phones the panel sits below the map: bring it into view
    if (window.matchMedia("(max-width: 767px)").matches) {
      window.requestAnimationFrame(() => asideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  // A link to an event older than the current time window widens the window rather than
  // silently showing nothing. Only when a NEW event is picked: once the reader changes the
  // window or a filter themselves, the event simply drops out of view.
  const widenedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = view.selectedEvent;
    if (!id || widenedFor.current === id) return;
    widenedFor.current = id;
    const ev = events.find((e) => e.id === id);
    if (!ev || view.windowHours == null) return;
    const start = new Date(issue.info_cutoff).getTime() - view.windowHours * 3_600_000;
    if (new Date(ev.occurredAt).getTime() < start) updateView({ windowHours: null });
  }, [view.selectedEvent, view.windowHours, events, issue.info_cutoff, updateView]);

  // Search box: typing updates the map and list at once; the URL follows shortly after.
  const [query, setQuery] = useState(view.q);
  useEffect(() => setQuery(view.q), [view.q]);
  useEffect(() => {
    if (query === viewRef.current.q) return;
    const t = window.setTimeout(() => updateView({ q: query }), 250);
    return () => window.clearTimeout(t);
  }, [query, updateView]);

  // Map key: open by default on wide screens, behind a "Key" button on phones.
  const [keyOpen, setKeyOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setKeyOpen(true);
  }, []);

  const filtersRef = useRef<HTMLDetailsElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  // Re-fit the map when what's shown changes, or when "Show all" is pressed.
  const fitKey = [view.windowHours, view.q, view.affiliations.join(), view.categories.join(), view.usOnly, view.confidenceFloor].join("|");
  const [overviewNonce, setOverviewNonce] = useState(0);

  // Phones: hide the "List of N events" button once the list itself is on screen.
  const [listInView, setListInView] = useState(false);
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setListInView(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const asideRef = useRef<HTMLElement>(null);

  const affColor = (a: Affiliation) => AFF_META.find((m) => m.key === a)?.hex ?? "#171712";
  const affFill = (a: Affiliation) => AFF_META.find((m) => m.key === a)?.fill ?? "#f5f2ea";
  const title = allTheaters ? "World" : regionName(issue.aor);
  const anyFilter = secondaryActive || view.affiliations.length > 0 || view.q.trim() !== "";
  const clearFilters = () => {
    setQuery("");
    updateView({ affiliations: [], categories: [], usOnly: false, confidenceFloor: "low", q: "" });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden">
      {/* Masthead — UX-4: info cut-off always visible */}
      <header className="border-b-2 border-[#171712] px-4 py-2 bg-[#f5f2ea] shrink-0 space-y-1">
        <div className="flex items-center gap-x-3">
          <a href="/" className="text-[12px] text-[#6b675c] hover:text-[#171712] shrink-0">
            ◂ Home
          </a>
          <h1 className="headline text-xl sm:text-2xl leading-none min-w-0">{title}</h1>
          {!allTheaters && <span className="hidden sm:inline font-mono text-[10px] text-[#918c7d] shrink-0">{issue.aor}</span>}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {!allTheaters && (
              <a
                href={`${reportHref ?? `/t/${issue.aor.toLowerCase()}/report`}${typeof window !== "undefined" && window.location.search ? window.location.search : ""}`}
                className="text-[12px] px-2.5 py-1.5 border border-[#171712] hover:bg-[#efeadb] whitespace-nowrap"
              >
                <span className="sm:hidden">Print</span>
                <span className="hidden sm:inline">Printable report</span>
              </a>
            )}
            <AccountLink />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <span className="text-[#3a382e]" title={`Information current to ${plainUtc(issue.info_cutoff)}`}>
            Updated {now !== null ? ageLabel(issue.info_cutoff, now) : plainUtc(issue.info_cutoff)}
            <span className="text-[#8a6100]">
              {" "}· info as of <When iso={issue.info_cutoff} ago={false} />
              <span className="hidden sm:inline font-mono text-[10px]"> ({zulu(issue.info_cutoff)})</span>
            </span>
          </span>
          <label className="flex items-center gap-1 text-[#6b675c]">
            Region
            <select
              value={allTheaters ? "all" : issue.aor.toLowerCase()}
              onChange={(e) => {
                // keep the reader's time window and filters; a search and an event pick belong
                // to the region they were made in
                const qs = encodeView({ ...viewRef.current, selectedEvent: null, q: "" }).toString();
                router.push(`/t/${e.target.value}${qs ? `?${qs}` : ""}`);
              }}
              className="bg-[#efeadb] border border-[#c9c2ac] px-1 py-0.5 text-[#171712]"
            >
              <option value="all">World</option>
              {REGIONS.map((r) => (
                <option key={r.aor} value={r.aor.toLowerCase()}>
                  {r.region}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* Controls: search · time · more filters · community · count (wraps on phones) */}
      <div className="border-b border-[#c9c2ac] px-4 py-2 flex flex-wrap items-center gap-2 bg-[#efeadb] text-[12px] shrink-0">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place or word…"
          aria-label="Search events"
          maxLength={100}
          className="flex-1 min-w-[9rem] sm:flex-none sm:w-56 px-2.5 py-1.5 bg-[#f5f2ea] border border-[#c9c2ac] focus:border-[#171712] outline-none"
        />
        <details
          ref={filtersRef}
          className="relative"
          onKeyDown={(e) => {
            if (e.key === "Escape" && filtersRef.current) filtersRef.current.open = false;
          }}
        >
          <summary
            className={`list-none cursor-pointer px-2.5 py-1.5 border select-none ${
              secondaryActive ? "border-[#8a6100] text-[#8a6100]" : "border-[#c9c2ac] text-[#514d43] hover:border-[#6b675c]"
            }`}
          >
            More filters {secondaryActive ? "●" : "▾"}
          </summary>
          <div className="absolute right-0 sm:right-auto sm:left-0 z-30 mt-1 w-64 max-w-[calc(100vw-32px)] bg-[#f5f2ea] border border-[#171712] shadow-lg p-3 space-y-3">
            <label className="block">
              <span className="block text-[11px] text-[#6b675c] mb-1">Type of event</span>
              <select
                value={view.categories[0] ?? ""}
                onChange={(e) => updateView({ categories: e.target.value ? [e.target.value as EventCategory] : [] })}
                className="w-full bg-[#efeadb] border border-[#c9c2ac] px-2 py-1"
              >
                <option value="">All types</option>
                {CATS.map((c) => (
                  <option key={c} value={c}>{CATEGORY_PLAIN[c]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] text-[#6b675c] mb-1">How sure we are of the place</span>
              <select
                value={view.confidenceFloor}
                onChange={(e) => updateView({ confidenceFloor: e.target.value as ViewState["confidenceFloor"] })}
                className="w-full bg-[#efeadb] border border-[#c9c2ac] px-2 py-1"
              >
                <option value="low">Show everything</option>
                <option value="moderate">Fairly sure or better</option>
                <option value="high">Very sure only</option>
              </select>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={view.usOnly} onChange={() => updateView({ usOnly: !view.usOnly })} />
              <span>Only events involving US forces</span>
            </label>
            <button
              onClick={() => {
                if (filtersRef.current) filtersRef.current.open = false;
              }}
              className="w-full py-1.5 bg-[#171712] text-[#f5f2ea]"
            >
              Done
            </button>
          </div>
        </details>
        <div className="flex" role="group" aria-label="Time period">
          {WINDOW_PRESETS.map((w, i) => (
            <button
              key={w.label}
              onClick={() => updateView({ windowHours: w.hours })}
              aria-pressed={view.windowHours === w.hours}
              className={`px-2.5 py-1.5 border ${i > 0 ? "-ml-px" : ""} ${
                view.windowHours === w.hours
                  ? "relative border-[#171712] bg-[#171712] text-[#f5f2ea]"
                  : "border-[#c9c2ac] text-[#514d43] hover:border-[#6b675c]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        {!allTheaters && (
          <button
            onClick={() => {
              const on = !communityOn;
              setCommunityOn(on);
              if (!on) {
                setCommunitySel(null);
                if (tab === "community") setTab("index");
              }
            }}
            aria-pressed={communityOn}
            title="Unverified reports sent in by users. Not part of the situation update."
            className={`px-2.5 py-1.5 border flex items-center gap-1.5 ${
              communityOn ? "text-white" : "border-[#c9c2ac] text-[#514d43] hover:border-[#6b675c]"
            }`}
            style={communityOn ? { backgroundColor: COMMUNITY_COLOR, borderColor: COMMUNITY_COLOR } : undefined}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: communityOn ? "#fff" : "transparent", border: `1.5px solid ${communityOn ? "#fff" : COMMUNITY_COLOR}` }}
            />
            Community reports
          </button>
        )}
        <span className="text-[#6b675c] sm:ml-auto">
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
          {unplotted.length > 0 && ` (${unplotted.length} without a map point)`}
          {filtered.length === 0 && view.windowHours != null && (
            <button onClick={() => updateView({ windowHours: null })} className="ml-2 underline hover:text-[#171712]">
              Try 30 days
            </button>
          )}
          {anyFilter && (
            <button onClick={clearFilters} className="ml-2 underline hover:text-[#171712]">
              Clear filters
            </button>
          )}
        </span>
      </div>

      {/* Main split: on phones the map takes most of the screen and the list follows below */}
      <div className="md:flex-1 md:min-h-0 flex flex-col md:flex-row">
        <div ref={mapWrapRef} className="relative shrink-0 h-[60dvh] min-h-[300px] md:h-auto md:min-h-0 md:flex-1 md:shrink">
          <TheaterMap
            events={plottable}
            referenceEvents={filtered}
            selectedId={view.selectedEvent}
            onSelect={(id) => {
              if (!id || !stackIds?.includes(id)) setStackIds(null);
              updateView({ selectedEvent: id });
            }}
            onSelectStack={(ids) => {
              setStackIds(ids);
              updateView({ selectedEvent: null });
            }}
            allTheaters={allTheaters}
            community={communityPoints}
            selectedCommunityId={communitySel}
            onSelectCommunity={(id) => openCommunity(id)}
            fitKey={fitKey}
            overviewKey={overviewNonce}
            overviewEvents={events}
          />

          <button
            onClick={() => setOverviewNonce((n) => n + 1)}
            className="absolute top-[78px] left-[10px] z-10 bg-white border border-[#c9c2ac] rounded px-1.5 py-1 text-[11px] shadow-sm hover:bg-[#efeadb]"
            title={allTheaters ? "Zoom out to the whole world" : "Zoom out to the whole region"}
          >
            {allTheaters ? "Whole world" : "Whole region"}
          </button>

          <MapKey
            affiliations={view.affiliations}
            onToggle={toggleAff}
            communityOn={communityOn && !allTheaters}
            aor={issue.aor}
            open={keyOpen}
            setOpen={setKeyOpen}
          />

          {!selected && stackEvents.length === 0 && !keyOpen && !listInView && (
            <button
              onClick={() => asideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-[#171712] text-[#f5f2ea] text-[12px] px-4 py-2 shadow"
            >
              List of {filtered.length} events ↓
            </button>
          )}

          {selected && (
            <EventCallout
              key={selected.id}
              event={selected}
              color={affColor(selected.affiliation)}
              fill={affFill(selected.affiliation)}
              onClose={() => {
                setStackIds(null);
                updateView({ selectedEvent: null });
              }}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onBack={
                inStack
                  ? { label: `All ${stackEvents.length} events at ${selected.placeName}`, go: () => updateView({ selectedEvent: null }) }
                  : undefined
              }
            />
          )}
          {!selected && stackEvents.length > 0 && (
            <StackList
              events={stackEvents}
              colorFor={affColor}
              fillFor={affFill}
              onPick={(id) => updateView({ selectedEvent: id })}
              onClose={() => setStackIds(null)}
            />
          )}
        </div>

        <aside
          ref={asideRef}
          className="shrink-0 h-[85dvh] md:h-auto md:w-[360px] md:border-l border-t md:border-t-0 border-[#c9c2ac] bg-[#f5f2ea] flex flex-col min-h-0"
        >
          <div role="tablist" className="flex border-b border-[#e3ddcc] text-[12px] shrink-0">
            {([
              ["index", "Events"],
              ...(allTheaters ? [] : [["community", "Community"], ["ask", "Ask AI"]]),
            ] as ["index" | "community" | "ask", string][]).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => (key === "community" ? openCommunity(communitySel) : setTab(key))}
                className={`flex-1 px-3 py-2.5 ${key !== "index" ? "border-l border-[#e3ddcc]" : ""} ${
                  tab === key ? "text-[#171712] font-semibold bg-[#efeadb]" : "text-[#6b675c] hover:text-[#171712]"
                }`}
                style={key === "community" && tab === key ? { color: COMMUNITY_COLOR } : undefined}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => mapWrapRef.current?.parentElement?.parentElement?.scrollTo({ top: 0, behavior: "smooth" })}
              className="md:hidden px-3 border-l border-[#e3ddcc] text-[#1f4e79]"
            >
              ↑ Map
            </button>
          </div>
          {tab === "ask" && !allTheaters ? (
            <AskPanel aor={issue.aor} cutoffIso={issue.info_cutoff} onSelectEvent={(id) => updateView({ selectedEvent: id })} />
          ) : tab === "community" && !allTheaters ? (
            <CommunityPanel
              aor={issue.aor}
              reports={community}
              loading={communityLoading}
              loadError={communityError}
              selectedId={communitySel}
              onSelect={setCommunitySel}
              onChanged={(id) => {
                if (id) setCommunitySel(id);
                setCommunityNonce((n) => n + 1);
              }}
              startWithForm={initialTab === "submit"}
            />
          ) : (
          <div ref={eventListRef} className="overflow-y-auto overscroll-contain flex-1">
            {filtered.length === 0 && (
              <div className="p-4 text-[13px] text-[#514d43] space-y-2">
                <p>No events match.</p>
                {view.windowHours != null && (
                  <button onClick={() => updateView({ windowHours: null })} className="underline">
                    Look at the last 30 days instead
                  </button>
                )}
                {anyFilter && (
                  <button onClick={clearFilters} className="block underline">
                    Clear filters and search
                  </button>
                )}
              </div>
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
                  onClick={() => {
                    updateView({ selectedEvent: isSel ? null : e.id });
                    // on phones, bring the map (with the card) back into view
                    if (!isSel && window.matchMedia("(max-width: 767px)").matches) {
                      mapWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  aria-current={isSel ? "true" : undefined}
                  className={`w-full text-left pl-3 pr-4 py-2.5 border-b border-[#e3ddcc] border-l-[3px] transition-colors ${
                    isSel ? "bg-[#ece5d0]" : "border-l-transparent hover:bg-[#efeadb]"
                  }`}
                  style={isSel ? { borderLeftColor: affColor(e.affiliation) } : undefined}
                >
                  <div className="flex items-baseline gap-2.5">
                    <span
                      className="shrink-0 font-mono text-[11px] font-bold w-6 text-center"
                      style={{ color: affColor(e.affiliation) }}
                      title="Event number, also shown on its map symbol"
                    >
                      {e.num}
                    </span>
                    <span className="text-[14px] font-medium leading-snug">{e.title}</span>
                  </div>
                  <div className="text-[11px] text-[#6b675c] mt-1 pl-[34px] flex flex-wrap gap-x-2">
                    <When iso={e.occurredAt} />
                    <span>· {e.placeName}</span>
                    {(e.lat == null || e.lon == null) && <span className="text-[#8a6100]">· no map point</span>}
                    {e.usForcesFlag && <span className="font-semibold text-[#3a382e]">· US forces involved</span>}
                  </div>
                </button>
              );
            })}
            {view.q.trim() && view.windowHours != null && filtered.length > 0 && (
              <button onClick={() => updateView({ windowHours: null })} className="w-full p-3 text-[12px] text-[#1f4e79] underline text-left">
                Only searching the last {WINDOW_PRESETS.find((w) => w.hours === view.windowHours)?.label ?? `${view.windowHours} hours`}. Search all 30 days
              </button>
            )}
          </div>
          )}
        </aside>
      </div>

      {/* Sourcing + symbology statements */}
      <footer className="hidden sm:flex border-t border-[#c9c2ac] px-4 py-1.5 bg-[#efeadb] shrink-0 text-[10px] text-[#6b675c] flex-wrap gap-x-3">
        <span className="truncate max-w-full" title={issue.source_summary?.statement}>
          {issue.source_summary?.statement}
        </span>
        <span className="hidden sm:inline">Symbols follow the US/NATO military map standard (MIL-STD-2525E).</span>
        {!allTheaters && (
          <a href={`/t/${issue.aor.toLowerCase()}/history`} className="underline hover:text-[#171712]">
            Past updates
          </a>
        )}
      </footer>
    </div>
  );
}
