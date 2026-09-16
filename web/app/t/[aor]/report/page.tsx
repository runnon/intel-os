import { notFound } from "next/navigation";
import type { Aor } from "@intel-os/core";
import { latestIssueFor } from "@/lib/db";
import ReportSheet from "@/components/ReportSheet";

export const dynamic = "force-dynamic";

const VALID: Record<string, Aor> = {
  centcom: "CENTCOM", eucom: "EUCOM", indopacom: "INDOPACOM",
  africom: "AFRICOM", northcom: "NORTHCOM", southcom: "SOUTHCOM",
};

export default async function ReportPage({ params }: PageProps<"/t/[aor]/report">) {
  const { aor: slug } = await params;
  const aor = VALID[slug.toLowerCase()];
  if (!aor) notFound();
  const issue = await latestIssueFor(aor);
  if (!issue) notFound();
  return <ReportSheet issue={issue} />;
}
