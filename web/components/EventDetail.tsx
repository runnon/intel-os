"use client";

import { factualUsImpact, isSocialSource } from "@intel-os/core";
import type { NumberedEvent } from "./TheaterMap";
import When from "./When";
import { AFF_PLAIN, CATEGORY_PLAIN, CONF_PLAIN, wherePlain } from "@/lib/plain";

// Card docked over the map: a bottom sheet on phones, a panel at the top-left on wider
// screens, so it is never cut off.
export const CARD_POSITION =
  "absolute z-20 inset-x-0 bottom-0 max-h-[62%] md:inset-x-auto md:bottom-auto md:left-3 md:top-[96px] md:w-[340px] md:max-h-[calc(100%-120px)]";

// Selection callout (spec §3 event detail): reported fact, US impact,
// confidence split (DATA-5), and resolvable sources (DATA-1), in plain words.
export default function EventCallout({
  event,
  color,
  fill,
  onClose,
  onPrev,
  onNext,
  onBack,
}: {
  event: NumberedEvent;
  color: string;
  fill: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Opened from a same-location list: return to it. */
  onBack?: { label: string; go: () => void };
}) {
  const plotted = event.lat != null && event.lon != null;
  const usImpact = factualUsImpact(event.usImpact);
  // Independent news reports: social posts don't count, and a syndicated copy of the
  // same headline on another site counts once.
  const social = event.sources.filter((s) => isSocialSource(s)).length;
  const newsStories = new Set(
    event.sources
      .filter((s) => !isSocialSource(s))
      .map((s) => (s.title ?? s.url).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60)),
  ).size;
  const parts = [
    newsStories > 0 && `${newsStories} news ${newsStories === 1 ? "report" : "reports"}`,
    social > 0 && `${social} social media ${social === 1 ? "post" : "posts"}`,
  ].filter(Boolean);
  const sourceLine = (
    <>
      Reported in {parts.join(" and ")}.
      {newsStories < 2 && <span className="font-semibold text-[#8a6100]"> Not confirmed: needs a second news report.</span>}
    </>
  );
  return (
    <div
      role="dialog"
      aria-label={event.title}
      className={`${CARD_POSITION} flex flex-col bg-[#f5f2ea] border border-[#171712] shadow-xl`}
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      <div className="overflow-y-auto overscroll-contain flex-1">
        {onBack && (
          <button onClick={onBack.go} className="block w-full text-left px-4 pt-2.5 text-[12px] text-[#1f4e79] hover:underline">
            ◂ {onBack.label}
          </button>
        )}
        <div className="flex items-start gap-3 px-4 pt-3">
          <span
            className="shrink-0 w-7 h-7 mt-0.5 rotate-45 flex items-center justify-center"
            style={{ backgroundColor: fill, border: "2px solid rgba(10,14,18,0.9)" }}
            title={`Event ${event.num} (the number on the map symbol)`}
          >
            <span className="-rotate-45 font-mono text-[11px] font-bold text-[#171712]">{event.num}</span>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug">{event.title}</h3>
            <p className="text-[12px] text-[#6b675c] mt-1">
              {event.placeName}
              {event.country && event.country !== event.placeName ? `, ${event.country}` : ""} · <When iso={event.occurredAt} />
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-2 -mt-1 w-9 h-9 flex items-center justify-center text-lg text-[#6b675c] hover:text-[#171712] hover:bg-[#eae4d2]"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5 mt-2.5 text-[11px]">
            <span className="px-2 py-0.5 border" style={{ borderColor: color, color }}>
              {AFF_PLAIN[event.affiliation].short}
            </span>
            <span className="px-2 py-0.5 border border-[#c9c2ac] text-[#514d43]">{CATEGORY_PLAIN[event.category]}</span>
            {event.usForcesFlag && <span className="px-2 py-0.5 border border-[#a02c2c] text-[#a02c2c]">US forces involved</span>}
          </div>

          <p className="text-[12px] text-[#3a382e] mt-2">{sourceLine}</p>

          <p className="text-[13px] text-[#3a382e] mt-2 leading-relaxed">{event.summary}</p>

          {/* AUTO-5: only a reported, direct effect; assessment-shaped lines are withheld */}
          {usImpact && (
            <p className="mt-2.5 text-[12px] leading-snug">
              <span className="font-semibold text-[#a02c2c]">Effect on US forces: </span>
              {usImpact}
            </p>
          )}

          <div className="mt-3 border-t border-[#dcd6c4] pt-2">
            <div className="text-[12px] text-[#6b675c]">Sources</div>
            <ul className="mt-1 space-y-1">
              {event.sources.map((s) => (
                <li key={s.url} className="text-[12px] leading-snug">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#1f4e79] hover:underline">
                    {s.outlet}
                    {isSocialSource(s) ? " (social media post)" : ""}
                    {s.title ? ` — ${s.title}` : ""}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <dl className="mt-3 border-t border-[#dcd6c4] pt-2 text-[12px] grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-[#6b675c]">Where</dt>
            <dd>{wherePlain(event.precision, plotted)}</dd>
            <dt className="text-[#6b675c]">Sure of the area?</dt>
            <dd>{CONF_PLAIN[event.confOrigin]}</dd>
            <dt className="text-[#6b675c]">Sure who did it?</dt>
            <dd>{CONF_PLAIN[event.confActor]}</dd>
          </dl>
        </div>
      </div>

      {/* step through events in time order */}
      <div className="flex border-t border-[#171712] text-[12px] shrink-0">
        <button onClick={onPrev} className="flex-1 py-2 hover:bg-[#eae4d2] border-r border-[#dcd6c4]">
          ◂ Older
        </button>
        <button onClick={onNext} className="flex-1 py-2 hover:bg-[#eae4d2]">
          Newer ▸
        </button>
      </div>
    </div>
  );
}
