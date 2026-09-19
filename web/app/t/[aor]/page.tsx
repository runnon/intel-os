import { notFound } from "next/navigation";
import type { Aor } from "@intel-os/core";
import { latestIssueFor, combinedLatestIssue } from "@/lib/db";
import { getViewerEntitlement } from "@/lib/entitlement";
import TheaterView from "@/components/TheaterView";

export const dynamic = "force-dynamic";

const VALID: Record<string, Aor> = {
  centcom: "CENTCOM",
  eucom: "EUCOM",
  indopacom: "INDOPACOM",
  africom: "AFRICOM",
  northcom: "NORTHCOM",
  southcom: "SOUTHCOM",
};

export default async function TheaterPage({ params }: PageProps<"/t/[aor]">) {
  const { aor: slug } = await params;
  const access = await getViewerEntitlement();

  // "All theaters": every AOR's latest public events on one global map.
  if (slug.toLowerCase() === "all") {
    const combined = await combinedLatestIssue();
    if (!combined) notFound();
    return (
      <TheaterView
        issue={combined}
        hasArchiveAccess={access.active}
        signedIn={Boolean(access.user)}
        allTheaters
      />
    );
  }

  const aor = VALID[slug.toLowerCase()];
  if (!aor) notFound();
  const issue = await latestIssueFor(aor, access.active);
  if (!issue) notFound();
  return <TheaterView issue={issue} hasArchiveAccess={access.active} signedIn={Boolean(access.user)} />;
}
