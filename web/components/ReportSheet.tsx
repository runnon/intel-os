"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IDENTITY_COLOR_LIGHT } from "@intel-os/core";
import type { IssueRow } from "@/lib/db";
import { applyView, decodeView } from "@/lib/urlState";
import TheaterMap, { type NumberedEvent } from "./TheaterMap";
import { zulu } from "./TheaterView";

const MARKING = "OPEN SOURCES ONLY · NOT AN OFFICIAL GOVERNMENT PRODUCT";
const COLS = 4; // event-register columns
const ROW_GAP = 6; // px, matches gap-1.5
// Vertical space available for register cards on one page, in px. The page is a
// fixed 1040×735 landscape card (see .report-page); this is what's left after the
// banners, footer, section header, and body padding.
const CARDS_AREA_H = 585;

function Banner() {
  return (
    <div className="sheet-banner bg-[#1f4a2e] text-[#dcead9] text-center text-[10px] tracking-[0.3em] font-mono py-1 shrink-0">
      {MARKING}
    </div>
  );
}

// One landscape page, styled to match the printed PDF: banner, body, page
// footer, banner. Fixed pixel size so the on-screen preview equals the export.
function ReportPage({
  children,
  pageNo,
  pageCount,
  serial,
}: {
  children: React.ReactNode;
  pageNo: number;
  pageCount: number;
  serial: string;
}) {
  return (
    <div className="report-page">
      <Banner />
      <div className="report-page__body flex flex-col px-8 py-4">{children}</div>
      <div className="shrink-0 flex items-center justify-between px-6 pb-1 font-mono text-[8px] text-black/45">
        <span>{serial}</span>
        <span>PAGE {pageNo} OF {pageCount}</span>
      </div>
      <Banner />
    </div>
  );
}

function EventCard({ e }: { e: NumberedEvent }) {
  const affBorder =
    e.affiliation === "hostile"
      ? "border-l-[#a02c2c]"
      : e.affiliation === "friendly"
        ? "border-l-[#1f6feb]"
        : e.affiliation === "neutral"
          ? "border-l-[#1a7f37]"
          : "border-l-[#b08800]";
  return (
    <div className={`bg-white border border-black/15 border-l-4 ${affBorder} p-2`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-sans font-bold text-[10px] uppercase leading-tight">{e.placeName}</h3>
        <span className="shrink-0 w-4 h-4 rounded-full bg-[#171712] text-white font-mono text-[7px] flex items-center justify-center">
          {e.num}
        </span>
      </div>
      <p className="font-mono text-[7px] text-black/55 mt-0.5 leading-tight">
        {(e.country ?? "—").toUpperCase()} · {zulu(e.occurredAt)} · {e.category.toUpperCase()} · {e.affiliation.toUpperCase()}
      </p>
      <p className="text-[9px] leading-snug mt-1">{e.summary}</p>
      {e.usImpact && (
        <div className="mt-1 pt-1 border-t border-black/10">
          <span className="font-mono text-[7px] tracking-widest text-[#8a2f2f]">US IMPACT </span>
          <span className="text-[8px] leading-snug">{e.usImpact}</span>
        </div>
      )}
    </div>
  );
}

// The briefable sheet (spec §3 Export): produced from the current filter and
// date state, styled on the OS-IRN-26-001 proof build. This is a SITUATION
// UPDATE sheet: per AUTO-5 it carries no key judgements, no assessment, no
// analysis-of-alternatives — those exist only in the signed assessment product.
export default function ReportSheet({ issue, backHref }: { issue: IssueRow; backHref?: string }) {
  const searchParams = useSearchParams();
  const view = decodeView(new URLSearchParams(searchParams.toString()));

  const events: NumberedEvent[] = useMemo(() => {
    const asc = [...(issue.snapshot ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const nums = new Map(asc.map((e, i) => [e.id, i + 1]));
    return (issue.snapshot ?? []).map((e) => ({ ...e, num: nums.get(e.id)! }));
  }, [issue.snapshot]);

  const filtered = useMemo(
    () => applyView(events, view, issue.info_cutoff).sort((a, b) => a.num - b.num),
    [events, view, issue.info_cutoff],
  );
  const plottable = filtered.filter((e) => e.lat != null && e.lon != null);
  const dateRange = `${zulu(issue.window_start)} – ${zulu(issue.info_cutoff)}`;

  // Content-aware pagination: measure each rendered card, then pack whole rows
  // (4 cards) onto a page until the next row wouldn't fit — so nothing is
  // truncated and no row is ever split across the page break.
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<NumberedEvent[][]>(() =>
    // pre-measure fallback: coarse chunks so SSR/first paint is sensible
    chunk(filtered, COLS * 4),
  );

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const cardEls = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
    if (cardEls.length !== filtered.length) return;
    const heights = cardEls.map((c) => c.offsetHeight);

    const result: NumberedEvent[][] = [];
    let current: NumberedEvent[] = [];
    let used = 0;
    for (let i = 0; i < filtered.length; i += COLS) {
      const rowCards = filtered.slice(i, i + COLS);
      const rowH = Math.max(...heights.slice(i, i + COLS)) + ROW_GAP;
      if (used + rowH > CARDS_AREA_H && current.length > 0) {
        result.push(current);
        current = [];
        used = 0;
      }
      current.push(...rowCards);
      used += rowH;
    }
    if (current.length) result.push(current);
    setPages(result);
  }, [filtered]);

  const pageCount = 1 + pages.length + 1; // cover + register pages + summary
  let pageNo = 0;
  const nextPage = () => ++pageNo;

  return (
    <div className="report-scroll flex-1 overflow-auto bg-[#e9e6dc] text-[#171712] print:bg-white">
      {/* controls — top of page, never printed */}
      <div className="w-[1040px] max-w-full mx-auto px-2 pt-4 pb-1 flex gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="font-mono text-xs px-4 py-2 rounded-md bg-[#171712] text-[#f5f2ea] hover:bg-[#3a382e]"
        >
          EXPORT PDF (PRINT)
        </button>
        <a
          href={`${backHref ?? `/t/${issue.aor.toLowerCase()}`}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
          className="font-mono text-xs px-4 py-2 rounded-md border border-[#171712] text-[#171712] hover:bg-black/5"
        >
          {backHref ? "BACK TO ISSUE" : "BACK TO LIVE PICTURE"}
        </a>
        <span className="font-mono text-[10px] text-black/45 self-center ml-auto">{pageCount} PAGES · PREVIEW MATCHES EXPORT</span>
      </div>

      {/* hidden measuring grid — full-content cards at the real column width */}
      <div aria-hidden className="fixed -left-[9999px] top-0 w-[976px] pointer-events-none print:hidden">
        <div ref={measureRef} className="grid grid-cols-4 gap-1.5 items-start">
          {filtered.map((e) => (
            <div key={e.id} data-card>
              <EventCard e={e} />
            </div>
          ))}
        </div>
      </div>

      {/* ---- PAGE 1: cover — masthead, statement, map, legend ---- */}
      <ReportPage pageNo={nextPage()} pageCount={pageCount} serial={issue.serial}>
        <div className="flex flex-wrap justify-between gap-4 border-b-2 border-[#171712] pb-2 shrink-0">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] tracking-[0.25em] text-black/60">
              SITUATION UPDATE PRODUCT · {issue.aor} · GRAPHIC · MACHINE-ASSEMBLED
            </p>
            <h1 className="headline text-3xl mt-0.5">{issue.aor} THEATER PICTURE</h1>
            <p className="font-mono text-xs mt-0.5 text-black/70">REPORTED EVENTS, {dateRange}</p>
          </div>
          <table className="font-mono text-[10px] self-start">
            <tbody>
              {(
                [
                  ["SERIAL", issue.serial],
                  ["INFO CUT-OFF", zulu(issue.info_cutoff)],
                  ["PUBLISHED", zulu(issue.published_at)],
                  ["EVENTS SHOWN", `${filtered.length} (${plottable.length} plotted)`],
                  ["SOURCE BASIS", "OSINT only"],
                  ["PREPARED BY", "Unattended pipeline — no analyst"],
                  ["DISTRIBUTION", "Approved for public release"],
                ] as const
              ).map(([k, v]) => (
                <tr key={k}>
                  <td className="pr-4 text-black/50 align-top">{k}</td>
                  <td className="font-semibold">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-black/20 bg-[#ece8db] px-3 py-1.5 mt-2 font-mono text-[9px] leading-snug shrink-0">
          This sheet is generated unattended from publicly available reporting. It contains
          reported facts only — no key judgements, no assessment, and no analysis of alternatives.
          Judgement publishes solely in a separately signed assessment product over a named
          analyst&apos;s signature. No such product accompanies this issue.
        </div>

        <div className="report-map relative w-full flex-1 min-h-0 mt-2 border border-black/25">
          <TheaterMap events={plottable} referenceEvents={filtered} selectedId={null} onSelect={() => {}} forExport />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 mt-2 border-t border-black/15 pt-1.5 shrink-0">
          <div>
            <h4 className="font-mono text-[9px] tracking-widest text-black/60">LEGEND</h4>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-4">
              {(
                [
                  ["hostile", "Hostile action"],
                  ["friendly", "Friendly / US action"],
                  ["neutral", "Neutral / third party"],
                  ["unknown", "Unknown / contested"],
                ] as const
              ).map(([key, label]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span
                    className="inline-block w-3 h-3 rotate-45 shrink-0"
                    style={{ backgroundColor: IDENTITY_COLOR_LIGHT[key], border: "1.5px solid rgba(10,14,18,0.85)" }}
                  />
                  <span className="text-[9px] leading-tight">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2.5">
                <span className="w-5 border-t-2 border-dashed border-[#8a6100]" />
                <span className="text-[9px] leading-tight">Mapped pipeline</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 border-t-2 border-dashed border-[#1f4e79]" />
                <span className="text-[9px] leading-tight">Shipping route</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-mono text-[9px] tracking-widest text-black/60">METHODOLOGY</h4>
            <p className="font-mono text-[8px] text-black/55 mt-1 leading-snug">
              Numbered points are events, chronological within the issue window; closely co-located
              symbols are slightly displaced for legibility, true positions kept in the data.
              Positions derive from place names validated against a curated gazetteer; events below
              the geolocation confidence threshold are listed in the register without a plotted
              point. Named pipelines use public mapped alignments; maritime routes follow a public
              shipping network and are representative corridors, not live vessel tracks.
            </p>
          </div>
        </div>
      </ReportPage>

      {/* ---- EVENT REGISTER pages (content-aware pagination) ---- */}
      {pages.map((chunkEvents, i) => (
        <ReportPage key={i} pageNo={nextPage()} pageCount={pageCount} serial={issue.serial}>
          <div className="flex items-baseline justify-between border-b-2 border-[#171712] pb-1 shrink-0">
            <h2 className="headline text-lg">Event Register{pages.length > 1 ? ` — ${i + 1}/${pages.length}` : ""}</h2>
            <span className="font-mono text-[10px] text-black/55">
              {issue.serial} · {filtered.length} EVENTS · INFO CUT-OFF {zulu(issue.info_cutoff)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2 content-start">
            {chunkEvents.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        </ReportPage>
      ))}

      {/* ---- SUMMARY page: change log + sources ---- */}
      <ReportPage pageNo={nextPage()} pageCount={pageCount} serial={issue.serial}>
        <div className="flex items-baseline justify-between border-b-2 border-[#171712] pb-1 shrink-0">
          <h2 className="headline text-lg">Change &amp; Sourcing</h2>
          <span className="font-mono text-[10px] text-black/55">{issue.serial}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div className="border border-black/20 p-3">
            <h4 className="font-mono text-[10px] tracking-widest text-black/60">CHANGE FROM PREVIOUS ISSUE</h4>
            {issue.change_log?.length ? (
              <ul className="mt-1.5 space-y-0.5 text-[10px] font-mono">
                {issue.change_log.slice(0, 16).map((c, i) => (
                  <li key={i}>
                    <span className={c.kind === "new" ? "text-[#1a7f37]" : "text-[#8a6100]"}>{c.kind.toUpperCase()}</span>{" "}
                    {c.summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[10px] font-mono">
                No change — reporting produced no new or revised events this cycle. A no-change
                issue is a product; silence is a fault.
              </p>
            )}
          </div>
          <div className="border border-black/20 p-3">
            <h4 className="font-mono text-[10px] tracking-widest text-black/60">SOURCE SUMMARY STATEMENT</h4>
            <p className="mt-1.5 text-[10px] leading-relaxed">{issue.source_summary?.statement}</p>
          </div>
        </div>
        <p className="font-mono text-[9px] text-black/50 mt-4">
          {issue.disclaimer} · {issue.serial} · Info cut-off {zulu(issue.info_cutoff)}
        </p>
      </ReportPage>
    </div>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
