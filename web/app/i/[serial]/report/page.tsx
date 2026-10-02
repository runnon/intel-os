import { notFound } from "next/navigation";
import { issueBySerial } from "@/lib/db";
import ReportSheet from "@/components/ReportSheet";

export const dynamic = "force-dynamic";

export default async function IssueReportPage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const normalized = decodeURIComponent(serial).toUpperCase();
  const issue = await issueBySerial(normalized);
  if (!issue) notFound();
  return <ReportSheet issue={issue} backHref={`/i/${encodeURIComponent(normalized)}`} />;
}
