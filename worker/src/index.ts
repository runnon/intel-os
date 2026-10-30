import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { configuredAors, fetchGlobalPool, selectForAor, type GlobalPool } from './feeds';
import { makeClaudeExtractor } from './extract';
import { makeSupabaseStore } from './store';
import { runIngestOnce } from './pipeline';
import { runXPost } from './xpost';
import { codeVersion } from './version';

// Railway cron entrypoint: one ingest cycle across every configured AOR, then
// exit. Exit code 1 if any AOR failed so the platform surfaces it (AUTO-9
// alerting).
//
// All sources are fetched ONCE into a shared pool; each command then selects
// its relevant slice from the whole pool. Every theater therefore mines the
// full breadth of reporting — the broad sources that made CENTCOM rich now feed
// all six commands, not just their own regional feeds.
//
// Every row this cycle writes to ingest_runs carries the same cycle id, the code
// version and the source health, and a cycle that dies while fetching still records
// a failed run per AOR — before 2026-10-30 that path threw past the recorder, so a
// missed cycle left no trace at all (the 36-hour gap of 10-22).

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const aors = configuredAors(process.env.AORS ?? process.env.AOR);
const store = makeSupabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const cycleStart = new Date();
const meta = { cycleId: randomUUID(), codeVersion: codeVersion() };
console.log(JSON.stringify({ cycle: meta.cycleId, version: meta.codeVersion, aors }));

let pool: GlobalPool;
let extract: ReturnType<typeof makeClaudeExtractor>;
try {
  extract = makeClaudeExtractor();
  pool = await fetchGlobalPool();
} catch (e) {
  const error = `cycle setup failed: ${e instanceof Error ? e.message : String(e)}`;
  console.error(error);
  for (const aor of aors) {
    try {
      await store.recordRun({ aor, ok: false, fetched: 0, extracted: 0, deduped: 0, error, ...meta });
    } catch (re) {
      console.error(`[${aor}] could not record the failed run: ${re instanceof Error ? re.message : re}`);
    }
  }
  process.exit(1);
}
console.log(JSON.stringify({ pool: pool.articles.length, sources: pool.health }));

let anyFailed = false;
for (const aor of aors) {
  const selected = selectForAor(pool.articles, aor);
  const result = await runIngestOnce(aor, {
    fetchFeeds: async () => selected,
    extract,
    store,
    runMeta: { ...meta, sourceHealth: pool.health },
  });
  console.log(JSON.stringify({ aor, selected: selected.length, ...result }));
  if (!result.ok) anyFailed = true;
}

// Distribution: one X thread from the issues this cycle published. Dry-run unless
// X_POST_ENABLED=1; a posting failure is logged and never fails the ingest run.
try {
  console.log(JSON.stringify({ x: await runXPost(store, cycleStart) }));
} catch (e) {
  console.warn(`[x] failed: ${e instanceof Error ? e.message : e}`);
}

process.exit(anyFailed ? 1 : 0);
