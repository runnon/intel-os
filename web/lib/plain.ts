import type { Affiliation, Confidence, EventCategory, Precision } from "@intel-os/core";

// Plain-English labels for the public map. The data model keeps its spec vocabulary
// (affiliation, confOrigin, precision); only what a reader sees is translated here.
// The affiliation labels describe who ACTED, never a judgement about them (DATA-4:
// unclaimed or contested attribution is "unclear", not a side).

export const AFF_PLAIN: Record<Affiliation, { short: string; long: string }> = {
  hostile: { short: "By forces opposed to the US", long: "Done by forces opposed to the US" },
  friendly: { short: "By US or allied forces", long: "Done by US or allied forces" },
  neutral: { short: "By others (neither side)", long: "Done by others, not on either side" },
  unknown: { short: "Unclear who did it", long: "Who did it is unclear or disputed" },
};

export const CATEGORY_PLAIN: Record<EventCategory, string> = {
  strike: "Strike / attack",
  ground: "Ground fighting",
  maritime: "At sea",
  infrastructure: "Infrastructure",
  "air-defense": "Air defense",
  movement: "Troop / ship movement",
  political: "Political / diplomatic",
  other: "Other",
};

export const CONF_PLAIN: Record<Confidence, string> = {
  high: "Very sure",
  moderate: "Fairly sure",
  low: "Not sure",
};

export function wherePlain(precision: Precision, plotted: boolean): string {
  if (!plotted) return "Not on the map: the place couldn't be pinned down";
  if (precision === "region") return "Only the general area is known, so the symbol sits in the middle of it";
  if (precision === "settlement") return "At or near the named place";
  return "Exact spot";
}
