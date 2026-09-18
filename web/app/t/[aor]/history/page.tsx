import Link from "next/link";
import { notFound } from "next/navigation";
import type { Aor } from "@intel-os/core";
import { issueArchive } from "@/lib/db";
import { getViewerEntitlement } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

const VALID: Record<string, Aor> = {
  centcom: "CENTCOM", eucom: "EUCOM", indopacom: "INDOPACOM",
  africom: "AFRICOM", northcom: "NORTHCOM", southcom: "SOUTHCOM",
};

function zulu(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z ${d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()} ${String(d.getUTCFullYear()).slice(2)}`;
}

// AUTO-10: the issue archive. Each serial links to the immutable snapshot.
export default async function HistoryPage({ params }: PageProps<"/t/[aor]/history">) {
  const { aor: slug } = await params;
  const aor = VALID[slug.toLowerCase()];
  if (!aor) notFound();
  const [data, access] = await Promise.all([issueArchive(aor), getViewerEntitlement()]);
  const latestIssueNumber = data[0]?.issue_number;
  const upgradeHref = access.user ? "/analyst" : `/signin?next=${encodeURIComponent(`/t/${slug}/history`)}`;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-6 flex items-baseline gap-4">
          <Link href={`/t/${slug}`} className="font-mono text-sm tracking-[0.25em] text-[#6b675c] hover:text-[#171712]">
            ◂ {aor}
          </Link>
          <h1 className="font-mono text-lg tracking-widest">ISSUE ARCHIVE</h1>
        </header>
        <p className="text-xs text-[#6b675c] mb-6 max-w-xl">
          Every published issue is retained and addressable — a sheet briefed on a given date
          can be produced again unchanged. The latest 72 hours are public; older immutable
          snapshots are included with Analyst access.
        </p>
        {!access.active && (
          <div className="mb-5 border-l-4 border-[#8a6100] bg-[#efeadb] px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-[#514d43]">Older issue metadata stays visible. Start a seven-day trial to open the full archive.</p>
            <Link href={upgradeHref} className="shrink-0 font-mono text-[10px] border border-[#171712] px-3 py-1.5 hover:bg-[#171712] hover:text-white">
              START FREE TRIAL
            </Link>
          </div>
        )}
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-[#918c7d] text-left border-b border-[#c9c2ac]">
              <th className="py-2 pr-4 font-normal">SERIAL</th>
              <th className="py-2 pr-4 font-normal">INFO CUT-OFF</th>
              <th className="py-2 pr-4 font-normal">EVENTS</th>
              <th className="py-2 pr-4 font-normal">NEW</th>
            </tr>
          </thead>
          <tbody>
            {data.map((i) => {
              const canOpen = access.active || i.issue_number === latestIssueNumber;
              return (
              <tr key={i.serial} className="border-b border-[#dcd6c4] hover:bg-[#efeadb]">
                <td className="py-2 pr-4">
                  {canOpen ? (
                    <Link href={`/i/${i.serial}`} className="text-[#171712] hover:underline">{i.serial}</Link>
                  ) : (
                    <Link href={upgradeHref} className="text-[#8a6100] hover:underline" title="Analyst archive access required">
                      {i.serial} · LOCKED
                    </Link>
                  )}
                </td>
                <td className="py-2 pr-4 text-[#6b675c]">{zulu(i.info_cutoff)}</td>
                <td className="py-2 pr-4">{i.tempo?.totalEvents ?? "—"}</td>
                <td className="py-2 pr-4">{i.tempo?.newSinceLastIssue ?? "—"}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
