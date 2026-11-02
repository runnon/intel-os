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

/** A source that gave only a date is stored at exactly 00:00:00 UTC. */
export function isDateOnly(iso: string): boolean {
  return /T00:00:00(\.000)?(Z|\+00:00)$/.test(new Date(iso).toISOString());
}

/**
 * "Nov 1, 6:21 AM EST" in the viewer's own time zone (or the zone given, for tests).
 * Readers who don't use Zulu DTGs see this; the DTG stays in the tooltip. A date-only
 * report reads "Oct 18 (time not reported)" on its UTC date: converting its midnight
 * to local time would show the wrong day and a time no source gave.
 */
export function localTime(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (isDateOnly(iso)) {
    return `${d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} (time not reported)`;
  }
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });
}
