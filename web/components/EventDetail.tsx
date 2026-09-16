"use client";

import type { TheaterEvent } from "@intel-os/core";
import { zulu } from "./TheaterView";

// Event detail (spec §3): reported fact, impact on friendly operations,
// affiliation basis, and the source — on one panel. DATA-1: every source is a
// resolvable link. DATA-5: origin and actor confidence shown separately.
export default function EventDetail({ event, onClose }: { event: TheaterEvent; onClose: () => void }) {
  return (
    <div className="border-t border-[#30363d] bg-[#161b22] p-4 max-h-[50%] overflow-y-auto shrink-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="headline text-base text-white">{event.title}</h3>
        <button onClick={onClose} className="font-mono text-xs text-[#8b949e] hover:text-white shrink-0">
          ✕
        </button>
      </div>
      <div className="font-mono text-[10px] text-[#8b949e] mt-1 flex flex-wrap gap-x-3">
        <span>{zulu(event.occurredAt)}</span>
        <span>
          {event.placeName.toUpperCase()}
          {event.country ? `, ${event.country.toUpperCase()}` : ""}
        </span>
        <span className="uppercase">{event.category}</span>
        <span className="uppercase text-[#8b949e]">{event.affiliation}</span>
      </div>

      <p className="text-xs text-[#e6edf3] mt-3 leading-relaxed">{event.summary}</p>

      {event.usImpact && (
        <div className="mt-3">
          <div className="font-mono text-[10px] tracking-widest text-amber-300">US IMPACT</div>
          <p className="text-xs text-[#e6edf3] mt-1 leading-relaxed">{event.usImpact}</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
        <div className="border border-[#30363d] rounded-md px-2.5 py-2">
          <div className="text-[#6e7681]">CONFIDENCE · ORIGIN</div>
          <div className="text-[#e6edf3] uppercase">{event.confOrigin}</div>
        </div>
        <div className="border border-[#30363d] rounded-md px-2.5 py-2">
          <div className="text-[#6e7681]">CONFIDENCE · ACTOR</div>
          <div className="text-[#e6edf3] uppercase">{event.confActor}</div>
        </div>
        <div className="border border-[#30363d] rounded-md px-2.5 py-2">
          <div className="text-[#6e7681]">POSITION</div>
          <div className="text-[#e6edf3] uppercase">
            {event.lat != null ? `${event.precision} · gazetteer-validated` : "withheld — low geolocation confidence"}
          </div>
        </div>
        <div className="border border-[#30363d] rounded-md px-2.5 py-2">
          <div className="text-[#6e7681]">US FORCES</div>
          <div className="text-[#e6edf3]">{event.usForcesFlag ? "AFFECTED / THREATENED" : "NOT DIRECTLY AFFECTED"}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="font-mono text-[10px] tracking-widest text-[#6e7681]">
          SOURCES ({event.sources.length})
          {event.sources.length <= 1 && (
            <span className="text-amber-400 ml-2">SINGLE SOURCE — NOT CONFIRMED</span>
          )}
        </div>
        <ul className="mt-1 space-y-1">
          {event.sources.map((s) => (
            <li key={s.url} className="text-xs">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4493f8] hover:underline break-all"
              >
                {s.outlet}
                {s.title ? ` — ${s.title}` : ""}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {event.revisions.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[10px] tracking-widest text-[#6e7681]">REVISIONS</div>
          <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-[#8b949e]">
            {event.revisions.map((r, i) => (
              <li key={i}>
                {zulu(r.at)} · {r.field}: “{r.prior}” → “{r.current}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
