import Link from "next/link";
import type { Aor } from "@intel-os/core";
import { latestIssues, type IssueRow } from "@/lib/db";

export const dynamic = "force-dynamic";

// Entry point (spec §3 Command Selector): six AOR tiles, each carrying its
// current state so the analyst knows what they're walking into — event count,
// info cut-off, and coverage honesty.
const AORS: { aor: Aor; label: string; region: string }[] = [
  { aor: "CENTCOM", label: "CENTCOM", region: "Middle East · Central & South Asia" },
  { aor: "EUCOM", label: "EUCOM", region: "Europe · Russia" },
  { aor: "INDOPACOM", label: "INDOPACOM", region: "Indo-Pacific" },
  { aor: "AFRICOM", label: "AFRICOM", region: "Africa" },
  { aor: "NORTHCOM", label: "NORTHCOM", region: "North America" },
  { aor: "SOUTHCOM", label: "SOUTHCOM", region: "Central & South America" },
];

function zulu(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z ${d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase()} ${String(d.getUTCFullYear()).slice(2)}`;
}

function Tile({ aor, label, region, issue }: { aor: Aor; label: string; region: string; issue?: IssueRow }) {
  const live = Boolean(issue);
  const inner = (
    <div
      className={`border rounded-md p-4 h-40 flex flex-col justify-between transition-colors ${
        live
          ? "border-[#30363d] bg-[#161b22] hover:border-[#8b949e] cursor-pointer"
          : "border-[#30363d] bg-[#0d1117] opacity-60"
      }`}
    >
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="headline text-base text-[#4493f8]">{label}</h2>
          {live ? (
            <span className="text-xs font-medium text-[#3fb950] border border-[#238636] rounded-full px-2 py-0.5">Live</span>
          ) : (
            <span className="text-xs font-medium text-[#6e7681] border border-[#30363d] rounded-full px-2 py-0.5">No coverage</span>
          )}
        </div>
        <p className="text-xs text-[#8b949e] mt-1.5">{region}</p>
      </div>
      {issue ? (
        <div className="font-mono text-xs text-[#8b949e] space-y-1">
          <div>
            {issue.tempo.totalEvents} events · {issue.tempo.newSinceLastIssue} new · issue{" "}
            {String(issue.issue_number).padStart(3, "0")}
          </div>
          <div className="text-[#6e7681]">CUT-OFF {zulu(issue.info_cutoff)} · events only, no assessment layer</div>
        </div>
      ) : (
        <div className="font-mono text-xs text-[#6e7681]">
          No published issues. This command has no ingest coverage yet — that is stated, not hidden.
        </div>
      )}
    </div>
  );
  return live ? <Link href={`/t/${aor.toLowerCase()}`}>{inner}</Link> : inner;
}

export default async function Home() {
  let issues: IssueRow[] = [];
  let dbError: string | null = null;
  try {
    issues = await latestIssues();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }
  const byAor = new Map(issues.map((i) => [i.aor, i]));

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <p className="font-mono text-xs text-[#8b949e] mb-1">UNCLASSIFIED THEATER AWARENESS</p>
          <h1 className="headline text-2xl text-[#e6edf3]">Theater Picture</h1>
          <p className="text-sm leading-relaxed text-[#8b949e] mt-2 max-w-2xl">
            Pick a combatant command for a live, filterable geospatial picture of that theater,
            built entirely from publicly available information on an unattended 12-hour cycle.
            Situation updates carry reported facts only — an assessment layer publishes solely
            over a named analyst&apos;s signature.
          </p>
        </header>
        {dbError && (
          <p className="mb-6 text-xs font-mono text-amber-400">data unavailable: {dbError}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AORS.map((a) => (
            <Tile key={a.aor} {...a} issue={byAor.get(a.aor)} />
          ))}
        </div>
      </div>
    </main>
  );
}
