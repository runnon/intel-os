import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Which code this cycle is running, recorded on every ingest_runs row. Railway sets
 * RAILWAY_GIT_COMMIT_SHA for GitHub-linked deploys; the deploy-worker workflow writes
 * worker/VERSION before `railway up`. A manual `railway up` from a laptop has neither,
 * which shows up as "unknown" — itself the signal that main was not what deployed.
 */
export function codeVersion(env: NodeJS.ProcessEnv = process.env): string {
  const sha = env.RAILWAY_GIT_COMMIT_SHA?.trim();
  if (sha) return sha.slice(0, 12);
  try {
    const v = readFileSync(fileURLToPath(new URL('../VERSION', import.meta.url)), 'utf8').trim();
    if (v) return v.slice(0, 40);
  } catch {
    // no VERSION file
  }
  return 'unknown';
}
