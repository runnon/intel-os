// Plain-language companions to the DTG cut-off ("301201Z OCT 26"), whose
// trailing year is easily misread as a day of the month.

/** "just now" / "12m ago" / "5h ago" / "3d ago" relative to `now` (ms). */
export function ageLabel(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "30 Oct 2026, 12:01 UTC" — unambiguous long form for tooltips. */
export function plainUtc(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
