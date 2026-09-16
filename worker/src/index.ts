import 'dotenv/config';
import type { Aor } from '@intel-os/core';
import { fetchAllFeeds } from './feeds';
import { makeClaudeExtractor } from './extract';
import { makeSupabaseStore } from './store';
import { runIngestOnce } from './pipeline';

// Railway cron entrypoint: runs one ingest cycle and exits.
// Exit code 1 on failure so the platform surfaces it (AUTO-9 alerting).

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const aor = (process.env.AOR ?? 'CENTCOM') as Aor;

const result = await runIngestOnce(aor, {
  fetchFeeds: fetchAllFeeds,
  extract: makeClaudeExtractor(),
  store: makeSupabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
});

console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
