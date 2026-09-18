import { notFound } from "next/navigation";
import { issueBySerial, issueMetadataBySerial } from "@/lib/db";
import { getViewerEntitlement } from "@/lib/entitlement";
import ArchiveAccessGate from "@/components/ArchiveAccessGate";
import ReportSheet from "@/components/ReportSheet";

export const dynamic = "force-dynamic";

export default async function IssueReportPage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const normalized = decodeURIComponent(serial).toUpperCase();
  const access = await getViewerEntitlement();
  const issue = await issueBySerial(normalized, access.active);
  if (issue) return <ReportSheet issue={issue} backHref={`/i/${encodeURIComponent(normalized)}`} />;

  const metadata = await issueMetadataBySerial(normalized);
  if (!metadata) notFound();
  return (
    <ArchiveAccessGate
      issue={metadata}
      signedIn={Boolean(access.user)}
      nextPath={`/i/${encodeURIComponent(normalized)}/report`}
    />
  );
}
