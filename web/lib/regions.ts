import type { Aor } from "@intel-os/core";

// Plain region names for a reader who has never heard of a combatant command. The
// command code stays visible, small, beside the region name.
export const REGIONS: { aor: Aor; region: string; covers: string }[] = [
  { aor: "CENTCOM", region: "Middle East", covers: "Iran, Iraq, Israel, Gulf states, Yemen & Red Sea, Afghanistan" },
  { aor: "EUCOM", region: "Europe", covers: "Ukraine, Russia, NATO countries" },
  { aor: "INDOPACOM", region: "Asia-Pacific", covers: "China, Taiwan, Koreas, Japan, India" },
  { aor: "AFRICOM", region: "Africa", covers: "Sudan, Sahel, Somalia, Libya" },
  { aor: "NORTHCOM", region: "North America", covers: "United States, Canada, Mexico" },
  { aor: "SOUTHCOM", region: "Latin America", covers: "Caribbean, Central & South America" },
];

export function regionName(aor: string): string {
  return REGIONS.find((r) => r.aor === aor)?.region ?? aor;
}
