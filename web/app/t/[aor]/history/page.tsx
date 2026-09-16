import Link from "next/link";
import { notFound } from "next/navigation";
import type { Aor } from "@intel-os/core";
import { supabase } from "@/lib/db";

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
  const { data, error } = await supabase
    .from("issues")
    .select("serial, issue_number, published_at, info_cutoff, tempo")
    .eq("aor", aor)
    .order("issue_number", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

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
          can be produced again unchanged. Serials link to the immutable snapshot as published.
        </p>
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
            {(data ?? []).map((i) => (
              <tr key={i.serial} className="border-b border-[#dcd6c4] hover:bg-[#efeadb]">
                <td className="py-2 pr-4">
                  <Link href={`/i/${i.serial}`} className="text-[#171712] hover:underline">
                    {i.serial}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-[#6b675c]">{zulu(i.info_cutoff)}</td>
                <td className="py-2 pr-4">{i.tempo?.totalEvents ?? "—"}</td>
                <td className="py-2 pr-4">{i.tempo?.newSinceLastIssue ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
