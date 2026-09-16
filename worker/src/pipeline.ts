import type { Aor, IngestRunResult } from '@intel-os/core';
import { buildSituationUpdate, dedupe } from '@intel-os/core';
import type { Article, FeedFetcher } from './feeds';
import type { ExtractorFn } from './extract';
import type { Store } from './store';

export interface PipelineDeps {
  fetchFeeds: FeedFetcher;
  extract: ExtractorFn;
  store: Store;
  now?: () => Date;
}

const WINDOW_DAYS = 30; // events shown in an issue window

/**
 * The 12-hour loop (spec §4.5).
 * AUTO-1: publishes a situation update whether or not new events were found.
 * AUTO-2: dedups against prior events, carrying all sources.
 * AUTO-9: any failure publishes nothing; the failed run is recorded for alerting.
 * AUTO-10: the issue snapshots full event payloads so it can be reproduced unchanged.
 */
export async function runIngestOnce(aor: Aor, deps: PipelineDeps): Promise<IngestRunResult> {
  const now = deps.now?.() ?? new Date();
  let fetched = 0;
  let extracted = 0;
  let dedupedCount = 0;

  try {
    const articles: Article[] = await deps.fetchFeeds();
    fetched = articles.length;

    const candidates = await deps.extract(articles, aor);
    extracted = candidates.length;

    const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
    const existing = await deps.store.loadRecentEvents(aor, windowStart.toISOString());

    const { fresh, merged } = dedupe(candidates, existing);
    dedupedCount = candidates.length - fresh.length;

    await deps.store.insertEvents(fresh);
    await deps.store.mergeEventSources(merged);

    const allEvents = [
      ...existing.map((e) => merged.find((m) => m.id === e.id) ?? e),
      ...fresh,
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const issueNumber = await deps.store.nextIssueNumber(aor);
    const issue = buildSituationUpdate({
      aor,
      issueNumber,
      events: allEvents,
      newIds: new Set(fresh.map((e) => e.id)),
      revisedIds: new Set(merged.map((e) => e.id)),
      windowStart,
      infoCutoff: now,
      now,
    });

    const issueId = await deps.store.publishIssue(issue, allEvents);
    await deps.store.recordRun({ aor, ok: true, fetched, extracted, deduped: dedupedCount, publishedIssue: issueId });

    return { ok: true, fetched, extracted, deduped: dedupedCount, published: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // AUTO-9: publish nothing, record the failure so it can alert
    try {
      await deps.store.recordRun({ aor, ok: false, fetched, extracted, deduped: dedupedCount, error: message });
    } catch {
      // recording itself failed — surface the original error regardless
    }
    return { ok: false, fetched, extracted, deduped: dedupedCount, published: false, error: message };
  }
}
