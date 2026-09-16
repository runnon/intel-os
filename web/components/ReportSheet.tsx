"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { IssueRow } from "@/lib/db";
import { applyView, decodeView } from "@/lib/urlState";
import TheaterMap, { type NumberedEvent } from "./TheaterMap";
import { zulu } from "./TheaterView";

// The briefable sheet (spec §3 Export): produced from the current filter and
// date state, styled on the OS-IRN-26-001 proof build — masthead metadata block,
// plotted numbered events, callout cards, source summary. This is a SITUATION
// UPDATE sheet: per AUTO-5 it carries no key judgements, no assessment, no
// analysis-of-alternatives — those exist only in the signed assessment product.
export default function ReportSheet({ issue }: { issue: IssueRow }) {
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

  const affBorder = (a: string) =>
    a === "hostile" ? "border-l-[#a02c2c]" : a === "friendly" ? "border-l-[#1f6feb]" : a === "neutral" ? "border-l-[#1a7f37]" : "border-l-[#b08800]";

  const dateRange = `${zulu(issue.window_start)} – ${zulu(issue.info_cutoff)}`;

  return (
    <div className="flex-1 overflow-y-auto bg-[#e9e6dc] text-[#171712] print:bg-white">
      <div className="max-w-6xl mx-auto my-6 print:my-0 bg-[#f5f2ea] shadow-lg print:shadow-none border border-black/10">
        {/* sheet banner (MARK-1: marking on the sheet itself) */}
        <div className="bg-[#000057] text-[#f2f2f2] text-center text-[10px] tracking-[0.3em] font-mono py-1">
          UNCLASSIFIED · OPEN SOURCES ONLY · NOT AN OFFICIAL GOVERNMENT PRODUCT
        </div>

        <div className="p-8 print:p-6">
          {/* masthead */}
          <div className="flex flex-wrap justify-between gap-6 border-b-2 border-[#171712] pb-4">
            <div className="max-w-xl">
              <p className="font-mono text-[10px] tracking-[0.25em] text-black/60">
                SITUATION UPDATE PRODUCT · {issue.aor} · GRAPHIC · MACHINE-ASSEMBLED
              </p>
              <h1 className="headline text-4xl mt-1">{issue.aor} THEATER PICTURE</h1>
              <p className="font-mono text-xs mt-1 text-black/70">
                REPORTED EVENTS, {dateRange}
              </p>
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

          {/* AUTO-5 statement — this product type has no judgement layer, and says so */}
          <div className="border border-black/20 bg-[#ece8db] px-4 py-2.5 mt-4 font-mono text-[11px] leading-relaxed">
            (U) This sheet is generated unattended from publicly available reporting. It contains
            reported facts only — no key judgements, no assessment, and no analysis of
            alternatives. Judgement publishes solely in a separately signed assessment product
            over a named analyst&apos;s signature. No such product accompanies this issue.
          </div>

          {/* map */}
          <div className="relative h-[540px] mt-5 border border-black/25 print:h-[460px]">
            <TheaterMap events={plottable} selectedId={null} onSelect={() => {}} />
          </div>
          <p className="font-mono text-[9px] text-black/50 mt-1.5 leading-relaxed">
            (U) Numbered points are events, chronological within the issue window; symbols in
            tight groups are displaced for legibility. Positions derive from place names
            validated against a gazetteer; region-level reports carry dashed frames; events
            below the geolocation confidence threshold are listed without a plotted point.
            Symbology is MIL-STD-2525E-informed framing — the Activities symbol set defines no
            icons for conventional operations.
          </p>

          {/* event callouts, proof-build style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
            {filtered.map((e) => (
              <div key={e.id} className={`bg-white border border-black/15 border-l-4 ${affBorder(e.affiliation)} p-3 break-inside-avoid`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-sans font-bold text-[13px] uppercase leading-tight">{e.placeName}</h3>
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#171712] text-white font-mono text-[10px] flex items-center justify-center">
                    {e.num}
                  </span>
                </div>
                <p className="font-mono text-[9px] text-black/55 mt-0.5">
                  {(e.country ?? "—").toUpperCase()} · {zulu(e.occurredAt)} · {e.category.toUpperCase()} ·{" "}
                  {e.affiliation.toUpperCase()} · CONF {e.confOrigin.toUpperCase()}/{e.confActor.toUpperCase()}
                </p>
                <p className="text-[11px] leading-snug mt-1.5">{e.summary}</p>
                {e.usImpact && (
                  <div className="mt-1.5 pt-1.5 border-t border-black/10">
                    <span className="font-mono text-[8px] tracking-widest text-[#8a2f2f]">US IMPACT </span>
                    <span className="text-[10px] leading-snug">{e.usImpact}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* change log + sourcing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="border border-black/20 p-3">
              <h4 className="font-mono text-[10px] tracking-widest text-black/60">(U) CHANGE FROM PREVIOUS ISSUE</h4>
              {issue.change_log?.length ? (
                <ul className="mt-1.5 space-y-0.5 text-[10px] font-mono">
                  {issue.change_log.slice(0, 12).map((c, i) => (
                    <li key={i}>
                      <span className={c.kind === "new" ? "text-[#1a7f37]" : "text-[#8a6100]"}>
                        {c.kind.toUpperCase()}
                      </span>{" "}
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
              <h4 className="font-mono text-[10px] tracking-widest text-black/60">(U) SOURCE SUMMARY STATEMENT</h4>
              <p className="mt-1.5 text-[10px] leading-relaxed">{issue.source_summary?.statement}</p>
            </div>
          </div>

          <p className="font-mono text-[9px] text-black/50 mt-5">
            {issue.disclaimer} · {issue.serial} · Info cut-off {zulu(issue.info_cutoff)}
          </p>
        </div>

        <div className="bg-[#000057] text-[#f2f2f2] text-center text-[10px] tracking-[0.3em] font-mono py-1">
          UNCLASSIFIED · OPEN SOURCES ONLY · NOT AN OFFICIAL GOVERNMENT PRODUCT
        </div>
      </div>

      {/* controls — never printed */}
      <div className="max-w-6xl mx-auto pb-8 flex gap-3 print:hidden px-2">
        <button
          onClick={() => window.print()}
          className="font-mono text-xs px-4 py-2 rounded-md bg-[#000057] text-white hover:bg-[#1a1a7a]"
        >
          EXPORT PDF (PRINT)
        </button>
        <a
          href={`/t/${issue.aor.toLowerCase()}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
          className="font-mono text-xs px-4 py-2 rounded-md border border-[#000057] text-[#000057] hover:bg-black/5"
        >
          BACK TO LIVE PICTURE
        </a>
      </div>
    </div>
  );
}
