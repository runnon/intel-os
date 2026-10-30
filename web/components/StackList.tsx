"use client";

import type { Affiliation } from "@intel-os/core";
import type { NumberedEvent } from "./TheaterMap";
import { zulu } from "./TheaterView";

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
  const oldest = events[events.length - 1] ?? first;
  return (
    <div className="absolute top-[96px] left-3 z-20 w-[330px] max-w-[calc(100%-24px)] max-h-[calc(100%-152px)] flex flex-col bg-[#f5f2ea] border border-[#171712] shadow-xl">
      <div className="flex items-start gap-3 px-4 pt-3 pb-2 border-b border-[#dcd6c4] shrink-0">
        <div className="min-w-0 flex-1">
          <h3 className="headline text-base leading-tight">{first.placeName}</h3>
          <p className="font-mono text-[9px] text-[#6b675c] mt-0.5">
            {events.length} EVENTS AT THIS LOCATION · NEWEST FIRST
            <br />
            {zulu(oldest.occurredAt)} → {zulu(first.occurredAt)}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close list" className="font-mono text-sm text-[#6b675c] hover:text-[#171712] shrink-0 px-1">
          ✕
        </button>
      </div>
      <ol className="overflow-y-auto flex-1">
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
                <span className="block font-mono text-[9px] text-[#6b675c]">
                  {zulu(e.occurredAt)} · {e.category.toUpperCase()}
                </span>
                <span className="block text-[12px] leading-snug">{e.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
