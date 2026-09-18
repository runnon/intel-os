import Link from "next/link";
import type { IssueMetadata } from "@/lib/db";

export default function ArchiveAccessGate({
  issue,
  signedIn,
  nextPath,
}: {
  issue: IssueMetadata;
  signedIn: boolean;
  nextPath: string;
}) {
  const upgradeHref = signedIn ? "/analyst" : `/signin?next=${encodeURIComponent(nextPath)}`;
  return (
    <main className="flex-1 min-h-0 flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-xl border border-[#171712] bg-[#f5f2ea]">
        <div className="border-b border-[#c9c2ac] px-5 py-3 flex items-baseline justify-between gap-4">
          <h1 className="headline text-2xl">Archived situation update</h1>
          <span className="font-mono text-[10px] text-[#8a6100]">ANALYST ACCESS</span>
        </div>
        <div className="p-5">
          <p className="font-mono text-xs">{issue.serial} · {issue.aor}</p>
          <p className="mt-3 text-sm leading-relaxed text-[#514d43]">
            This immutable snapshot falls outside the public 72-hour window. Its metadata remains public;
            the event details, sources, coordinates, and report are available with Analyst access.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Link href={upgradeHref} className="bg-[#171712] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0b0b3b]">
              Start seven-day free trial
            </Link>
            <Link href={`/t/${issue.aor.toLowerCase()}/history`} className="font-mono text-xs underline text-[#6b675c]">
              Back to archive
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
