"use client";

import type { NumberedEvent } from "./TheaterMap";
import { zulu } from "./TheaterView";

// Selection callout (spec §3 event detail): reported fact, US impact,
// confidence split (DATA-5), and resolvable sources (DATA-1) — rendered as a
// proof-build callout card docked over the map, with prev/next stepping.
export default function EventCallout({
  event,
  color,
  fill,
  onClose,
  onPrev,
  onNext,
}: {
  event: NumberedEvent;
  color: string;
  fill: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="absolute top-[96px] left-3 z-20 w-[330px] max-w-[calc(100%-24px)] max-h-[calc(100%-152px)] overflow-y-auto bg-[#f5f2ea] border border-[#171712] shadow-xl"
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      {/* header */}
      <div className="flex items-start gap-3 px-4 pt-3">
        <span
          className="shrink-0 w-6 h-6 mt-0.5 rotate-45 flex items-center justify-center"
          style={{ backgroundColor: fill, border: "2px solid rgba(10,14,18,0.9)" }}
        >
          <span className="-rotate-45 font-mono text-[10px] font-bold text-[#171712]">{event.num}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="headline text-base leading-tight">{event.placeName}</h3>
          <p className="font-mono text-[9px] text-[#6b675c] mt-0.5">
            {(event.country ?? "—").toUpperCase()} · {zulu(event.occurredAt)} · {event.category.toUpperCase()} ·{" "}
            <span style={{ color }}>{event.affiliation.toUpperCase()}</span>
          </p>
        </div>
        <button onClick={onClose} className="font-mono text-sm text-[#6b675c] hover:text-[#171712] shrink-0 px-1">
          ✕
        </button>
      </div>

      <div className="px-4 pb-3">
        <p className="font-sans text-[13px] font-medium leading-snug mt-2">{event.title}</p>
        <p className="text-xs text-[#3a382e] mt-1.5 leading-relaxed">{event.summary}</p>

        {event.usImpact && (
          <div className="mt-2.5 border-t border-[#dcd6c4] pt-2">
            <span className="font-mono text-[9px] tracking-widest text-[#a02c2c]">US IMPACT </span>
            <span className="text-[11px] leading-snug">{event.usImpact}</span>
          </div>
        )}

        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[9px] border-t border-[#dcd6c4] pt-2">
          <div>
            <span className="text-[#918c7d]">CONF·ORIGIN </span>
            <span className="uppercase">{event.confOrigin}</span>
          </div>
          <div>
            <span className="text-[#918c7d]">CONF·ACTOR </span>
            <span className="uppercase">{event.confActor}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[#918c7d]">POSITION </span>
            <span className="uppercase">
              {event.lat != null ? `${event.precision} · gazetteer-validated` : "withheld — low confidence"}
            </span>
          </div>
        </div>

        <div className="mt-2.5 border-t border-[#dcd6c4] pt-2">
          <div className="font-mono text-[9px] tracking-widest text-[#918c7d]">
            SOURCES ({event.sources.length})
            {event.sources.length <= 1 && <span className="text-[#8a6100]"> · SINGLE SOURCE — NOT CONFIRMED</span>}
          </div>
          <ul className="mt-1 space-y-0.5">
            {event.sources.map((s) => (
              <li key={s.url} className="text-[11px] truncate">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#1f4e79] hover:underline">
                  {s.outlet}
                  {s.title ? ` — ${s.title}` : ""}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* prev / next stepping */}
      <div className="flex border-t border-[#171712] font-mono text-[10px]">
        <button onClick={onPrev} className="flex-1 py-1.5 hover:bg-[#eae4d2] border-r border-[#dcd6c4]">
          ◂ PREV EVENT
        </button>
        <button onClick={onNext} className="flex-1 py-1.5 hover:bg-[#eae4d2]">
          NEXT EVENT ▸
        </button>
      </div>
    </div>
  );
}
