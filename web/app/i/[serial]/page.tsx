import { notFound } from "next/navigation";
import { issueBySerial, issueMetadataBySerial } from "@/lib/db";
import { getViewerEntitlement } from "@/lib/entitlement";
import TheaterView from "@/components/TheaterView";
import ArchiveAccessGate from "@/components/ArchiveAccessGate";

export const dynamic = "force-dynamic";

// AUTO-10: every issue is retained and addressable — a sheet briefed on a given
// date can be produced again unchanged. This renders the immutable snapshot.
export default async function IssuePage({ params }: PageProps<"/i/[serial]">) {
  const { serial } = await params;
  const normalized = decodeURIComponent(serial).toUpperCase();
  const access = await getViewerEntitlement();
  const issue = await issueBySerial(normalized, access.active);
  if (issue) {
    return (
      <TheaterView
        issue={issue}
        hasArchiveAccess={access.active}
        signedIn={Boolean(access.user)}
        reportHref={`/i/${encodeURIComponent(normalized)}/report`}
      />
    );
  }

  const metadata = await issueMetadataBySerial(normalized);
  if (!metadata) notFound();
  return <ArchiveAccessGate issue={metadata} signedIn={Boolean(access.user)} nextPath={`/i/${encodeURIComponent(normalized)}`} />;
}
