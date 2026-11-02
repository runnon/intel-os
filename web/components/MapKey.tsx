"use client";

import type { Affiliation, Aor } from "@intel-os/core";
import { BLOCS, IDENTITY_COLOR_LIGHT } from "@intel-os/core";
import { symbolFor } from "@/lib/symbols";
import { AFF_PLAIN } from "@/lib/plain";
import { COMMUNITY_COLOR } from "@/lib/community";

const AFFS: Affiliation[] = ["hostile", "friendly", "neutral", "unknown"];

// The map key, in plain words, drawn with the same MIL-STD-2525 frames the map uses.
// The affiliation rows double as the "who acted" filter. Collapsed behind a "Key"
// button on phones so it never covers the map; open by default on wider screens.
export default function MapKey({
  affiliations,
  onToggle,
  communityOn,
  aor,
  open,
  setOpen,
}: {
  affiliations: Affiliation[];
  onToggle: (a: Affiliation) => void;
  communityOn: boolean;
  aor: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 right-3 z-10 bg-[#f5f2ea] border border-[#171712] px-3 py-1.5 text-[12px] font-semibold shadow"
        aria-expanded={false}
      >
        Key
      </button>
    );
  }

  const blocDef = BLOCS[aor as Aor];
  const symbols = AFFS.map((a) => ({ a, ...symbolFor({ affiliation: a, category: "other", precision: "point" }) }));
  const dashed = symbolFor({ affiliation: "unknown", category: "other", precision: "region" });

  return (
    <div className="absolute top-3 right-3 z-30 w-[230px] max-h-[calc(100%-24px)] overflow-y-auto overscroll-contain bg-[#f5f2ea] border border-[#171712] shadow text-[12px] text-[#171712]">
      <div className="sticky top-0 bg-[#f5f2ea] flex items-center justify-between px-3 pt-2">
        <span className="font-semibold">Key</span>
        <button onClick={() => setOpen(false)} aria-label="Hide key" className="w-8 h-8 -mr-2 text-base text-[#6b675c] hover:text-[#171712]">
          ✕
        </button>
      </div>
      <div className="px-3 pb-3">
        <p className="text-[11px] text-[#6b675c] mb-1">
          Colour shows who acted, using the US/NATO map standard, which labels sides relative to the US. Tap one to hide
          or show it.
        </p>
        {symbols.map(({ a, url, width, height }) => {
          const active = affiliations.length === 0 || affiliations.includes(a);
          return (
            <button
              key={a}
              onClick={() => onToggle(a)}
              aria-pressed={active}
              className={`flex items-center gap-2 py-1 w-full text-left ${active ? "" : "text-[#b7b1a0] line-through"}`}
            >
              <span className="w-7 flex justify-center shrink-0">
                <img src={url} alt="" width={width * 0.8} height={height * 0.8} style={{ opacity: active ? 1 : 0.35 }} />
              </span>
              {AFF_PLAIN[a].long}
            </button>
          );
        })}

        <div className="mt-2 border-t border-[#c9c2ac] pt-2 space-y-1.5 text-[11px] text-[#514d43]">
          <p>The number inside a symbol is the event&apos;s number in the list.</p>
          <div className="flex items-center gap-2">
            <span className="w-7 flex justify-center shrink-0">
              <img src={dashed.url} alt="" width={dashed.width * 0.8} height={dashed.height * 0.8} />
            </span>
            Dashed outline: only the area is known, not the exact spot.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-7 flex justify-center shrink-0">
              <span className="w-4 h-4 rounded-full bg-[#171712] text-[#f5f2ea] text-[9px] font-bold flex items-center justify-center">3</span>
            </span>
            Black badge: several events at one place. Tap to see them all.
          </div>
          {communityOn && (
            <div className="flex items-center gap-2">
              <span className="w-7 flex justify-center shrink-0">
                <span className="inline-block w-[10px] h-[10px] rounded-full border border-[#f5f2ea]" style={{ backgroundColor: COMMUNITY_COLOR }} />
              </span>
              Community report (unverified)
            </div>
          )}
        </div>

        <details className="mt-2 border-t border-[#c9c2ac] pt-2 text-[11px] text-[#514d43]">
          <summary className="cursor-pointer text-[#171712]">Places and lines on the map</summary>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 border-t-[2px] border-dashed border-[#8a6100] shrink-0" />
              Pipeline
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 border-t-[2px] border-dashed border-[#1f4e79] shrink-0" />
              Shipping route
            </div>
            {(
              [
                ["#1f4e79", "Airport / air base"],
                ["#2f7d8a", "Port / naval base"],
                ["#8a6100", "Oil, gas or power site"],
                ["#6b675c", "City"],
              ] as const
            ).map(([color, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-7 flex justify-center shrink-0">
                  <span className="inline-block w-[8px] h-[8px] rounded-full" style={{ backgroundColor: color, opacity: 0.8 }} />
                </span>
                {label}
              </div>
            ))}
            {(
              [
                ["friendly", "US or allied base"],
                ["neutral", "Local country's base"],
                ["hostile", "Opposing forces' base"],
              ] as const
            ).map(([aff, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-7 flex justify-center shrink-0">
                  <span className="inline-block w-[10px] h-[10px] border-2" style={{ borderColor: IDENTITY_COLOR_LIGHT[aff] }} />
                </span>
                {label}
              </div>
            ))}
            <p className="text-[#6b675c]">Bases show once you zoom in. Places are shown only if named in, or near, an event.</p>
            {blocDef && blocDef.blocs.length > 0 && (
              <>
                <p className="pt-1 text-[#171712]">Shaded countries: declared alliances (not who did what)</p>
                {blocDef.blocs.map((b) => (
                  <div key={b.key} className="flex items-center gap-2">
                    <span className="w-7 flex justify-center shrink-0">
                      <span className="inline-block w-4 h-3 border" style={{ backgroundColor: b.color, borderColor: "rgba(10,14,18,0.35)" }} />
                    </span>
                    {b.label}
                  </div>
                ))}
                {blocDef.alignments.some((x) => x.certainty === "contested") && (
                  <div className="flex items-center gap-2">
                    <span className="w-7 flex justify-center shrink-0">
                      <span
                        className="inline-block w-4 h-3 border border-[#6b675c]/50"
                        style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(90,86,78,0.8) 0 1px, transparent 1px 3px)" }}
                      />
                    </span>
                    Alliance disputed or uncertain
                  </div>
                )}
              </>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
