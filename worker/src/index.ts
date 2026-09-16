import 'dotenv/config';
import { configuredAors, fetchGlobalPool, selectForAor } from './feeds';
import { makeClaudeExtractor } from './extract';
import { makeSupabaseStore } from './store';
import { runIngestOnce } from './pipeline';

// Railway cron entrypoint: one ingest cycle across every configured AOR, then
// exit. Exit code 1 if any AOR failed so the platform surfaces it (AUTO-9
// alerting).
//
// All sources are fetched ONCE into a shared pool; each command then selects
// its relevant slice from the whole pool. Every theater therefore mines the
// full breadth of reporting — the broad sources that made CENTCOM rich now feed
// all six commands, not just their own regional feeds.

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const aors = configuredAors(process.env.AORS ?? process.env.AOR);
const store = makeSupabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const extract = makeClaudeExtractor();

const pool = await fetchGlobalPool();
console.log(JSON.stringify({ pool: pool.length, aors }));

let anyFailed = false;
for (const aor of aors) {
  const selected = selectForAor(pool, aor);
  const result = await runIngestOnce(aor, {
    fetchFeeds: async () => selected,
    extract,
    store,
  });
  console.log(JSON.stringify({ aor, selected: selected.length, ...result }));
  if (!result.ok) anyFailed = true;
}

process.exit(anyFailed ? 1 : 0);
