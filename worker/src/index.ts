import 'dotenv/config';
import { configuredAors, makeFeedFetcher } from './feeds';
import { makeClaudeExtractor } from './extract';
import { makeSupabaseStore } from './store';
import { runIngestOnce } from './pipeline';

// Railway cron entrypoint: one ingest cycle across every configured AOR, then
// exit. Exit code 1 if any AOR failed so the platform surfaces it (AUTO-9
// alerting). AORs run sequentially — a failure in one theater never blocks
// another's issue from publishing, and each AOR records its own run row.

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const aors = configuredAors(process.env.AORS ?? process.env.AOR);
const store = makeSupabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const extract = makeClaudeExtractor();

let anyFailed = false;
for (const aor of aors) {
  const result = await runIngestOnce(aor, {
    fetchFeeds: makeFeedFetcher(aor),
    extract,
    store,
  });
  console.log(JSON.stringify({ aor, ...result }));
  if (!result.ok) anyFailed = true;
}

process.exit(anyFailed ? 1 : 0);
