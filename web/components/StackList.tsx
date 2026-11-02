"use client";

import type { Affiliation } from "@intel-os/core";
import type { NumberedEvent } from "./TheaterMap";
import When from "./When";
import { CARD_POSITION } from "./EventDetail";
import { CATEGORY_PLAIN } from "@/lib/plain";

// Every event at one exact map position, newest first, docked where the event
// callout sits. Picking one opens its callout; the callout can step back here.
export default function StackList({
  events,
  colorFor,
  fillFor,
  onPick,
  onClose,
}: {
  events: NumberedEvent[];
  colorFor: (a: Affiliation) => string;
  fillFor: (a: Affiliation) => string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const first = events[0];
  if (!first) return null;
  return (
    <div className={`${CARD_POSITION} max-md:max-h-[45%] flex flex-col bg-[#f5f2ea] border border-[#171712] shadow-xl`}>
      <div className="flex items-start gap-3 px-4 pt-3 pb-2 border-b border-[#dcd6c4] shrink-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-tight">{first.placeName}</h3>
          <p className="text-[12px] text-[#6b675c] mt-0.5">{events.length} events at this place, now spread out on the map. Tap one here or on the map to read it.</p>
        </div>
        <button onClick={onClose} aria-label="Close list" className="shrink-0 -mr-2 -mt-1 w-9 h-9 flex items-center justify-center text-lg text-[#6b675c] hover:text-[#171712] hover:bg-[#eae4d2]">
          ✕
        </button>
      </div>
      <ol className="overflow-y-auto overscroll-contain flex-1">
        {events.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onPick(e.id)}
              className="w-full text-left flex items-start gap-2.5 px-4 py-2 border-b border-[#e3ddcc] hover:bg-[#eae4d2]"
              style={{ borderLeft: `3px solid ${colorFor(e.affiliation)}` }}
            >
              <span
                className="shrink-0 w-5 h-5 mt-0.5 rotate-45 flex items-center justify-center"
                style={{ backgroundColor: fillFor(e.affiliation), border: "1.5px solid rgba(10,14,18,0.9)" }}
              >
                <span className="-rotate-45 font-mono text-[9px] font-bold text-[#171712]">{e.num}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-snug">{e.title}</span>
                <span className="block text-[11px] text-[#6b675c] mt-0.5">
                  <When iso={e.occurredAt} /> · {CATEGORY_PLAIN[e.category]}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
