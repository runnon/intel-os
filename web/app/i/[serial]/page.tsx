import { notFound } from "next/navigation";
import { issueBySerial } from "@/lib/db";
import TheaterView from "@/components/TheaterView";

export const dynamic = "force-dynamic";

// AUTO-10: every issue is retained and addressable — a sheet briefed on a given
// date can be produced again unchanged. This renders the immutable snapshot.
export default async function IssuePage({ params }: PageProps<"/i/[serial]">) {
  const { serial } = await params;
  const issue = await issueBySerial(decodeURIComponent(serial).toUpperCase());
  if (!issue) notFound();
  return <TheaterView issue={issue} />;
}
