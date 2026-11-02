import Link from "next/link";
import type { Aor } from "@intel-os/core";
import { latestIssues, type IssueRow } from "@/lib/db";
import AccountLink from "@/components/AccountLink";
import { ageLabel, plainUtc } from "@/lib/age";
import { REGIONS } from "@/lib/regions";

export const dynamic = "force-dynamic";

// Entry point (spec §3 Command Selector). Written for someone who has never heard of a
// combatant command: regions lead in plain words, the command name is secondary, and
// freshness reads as "updated 2h ago". The DTG cut-off stays one click in, in the
// theater masthead (UX-4), and as the tile's tooltip.
const AORS = REGIONS;

function Tile({ aor, region, covers, issue }: { aor: Aor; region: string; covers: string; issue?: IssueRow }) {
  const inner = (
    <div
      className={`border p-4 h-full flex flex-col gap-3 transition-colors ${
        issue
          ? "border-[#c9c2ac] hover:border-[#171712] hover:bg-[#efeadb] active:bg-[#e3ddcc] cursor-pointer"
          : "border-[#c9c2ac] bg-[#f5f2ea] opacity-60"
      }`}
    >
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="headline text-2xl text-[#171712]">{region}</h2>
          <span className="font-mono text-[10px] text-[#918c7d]">{aor}</span>
        </div>
        <p className="text-xs text-[#6b675c] mt-1">{covers}</p>
      </div>
      {issue ? (
        <div className="mt-auto flex items-end justify-between gap-2 text-xs">
          <div>
            <span className="font-semibold text-[#171712]">{issue.tempo.newSinceLastIssue} new in the latest update</span>
            <span className="text-[#6b675c]"> · {issue.tempo.totalEvents} in 30 days</span>
          </div>
          <span className="text-[#6b675c] shrink-0" title={`Information current to ${plainUtc(issue.info_cutoff)}`}>
            Updated {ageLabel(issue.info_cutoff, Date.now())}
          </span>
        </div>
      ) : (
        <p className="mt-auto text-xs text-[#918c7d]">Not covered yet.</p>
      )}
    </div>
  );
  return issue ? (
    <Link href={`/t/${aor.toLowerCase()}`} aria-label={`${region} map`}>
      {inner}
    </Link>
  ) : (
    inner
  );
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
  const newest = issues.map((i) => i.info_cutoff).sort().at(-1);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="headline text-4xl sm:text-5xl text-[#171712]">Theater Picture</h1>
            <AccountLink />
          </div>
          <p className="text-base leading-relaxed text-[#3a382e] mt-3 max-w-2xl">
            A free map of military and security events around the world, built from public news reports and
            updated twice a day{newest ? ` (last update ${ageLabel(newest, Date.now())})` : ""}.
          </p>
          <p className="text-sm text-[#6b675c] mt-1 max-w-2xl">
            Facts only: what was reported, where, when, and by whom. No predictions or opinions. Not a government
            product: an independent, open-source project (
            <a href="https://github.com/runnon/intel-os" className="underline hover:text-[#171712]">code on GitHub</a>).
            Regions are grouped the way the US military divides the world, so each shows its command name too.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/t/all"
              className="font-mono text-xs px-4 py-2.5 bg-[#171712] text-[#f5f2ea] hover:bg-[#3a382e]"
            >
              SEE THE WORLD MAP →
            </Link>
            <span className="text-sm text-[#6b675c]">or pick a region:</span>
          </div>
        </header>

        {dbError && <p className="mb-6 text-xs font-mono text-[#8a6100]">Data is unavailable right now. Try again in a minute.</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {AORS.map((a) => (
            <Tile key={a.aor} {...a} issue={byAor.get(a.aor)} />
          ))}
        </div>

        <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-semibold">Click any symbol</h3>
            <p className="text-[#6b675c] mt-1">to see what happened and which news outlets reported it.</p>
          </div>
          <div>
            <h3 className="font-semibold">Ask AI</h3>
            <p className="text-[#6b675c] mt-1">
              Ask a region&apos;s map a question in plain English, like &ldquo;what happened today?&rdquo; Free account.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Send in a report</h3>
            <p className="text-[#6b675c] mt-1">
              Seen something in the news that isn&apos;t on the map? Add it, with a link, to the community layer. Free
              account.
            </p>
          </div>
        </section>

        <footer className="mt-10 pt-4 border-t border-[#c9c2ac] text-xs text-[#6b675c] flex flex-wrap gap-x-5 gap-y-1">
          <span>For analysts:</span>
          <a href="/analyst" className="underline hover:text-[#171712]">Report drafting workspace</a>
          <a href="/t/centcom/history" className="underline hover:text-[#171712]">Issue archive</a>
          <a href="https://github.com/runnon/intel-os" className="underline hover:text-[#171712]">Open source on GitHub</a>
        </footer>
      </div>
    </main>
  );
}
