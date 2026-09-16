import { createClient } from '@supabase/supabase-js';
import type { Aor, SituationUpdate, TheaterEvent } from '@intel-os/core';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, { auth: { persistSession: false } });

export interface IssueRow {
  id: string;
  serial: string;
  aor: Aor;
  issue_number: number;
  product_type: string;
  window_start: string;
  info_cutoff: string;
  published_at: string;
  event_ids: string[];
  tempo: SituationUpdate['tempo'];
  change_log: SituationUpdate['changeLog'];
  source_summary: SituationUpdate['sourceSummary'];
  disclaimer: string;
  snapshot: TheaterEvent[];
}

/** Latest issue per AOR — powers the command selector tiles. */
export async function latestIssues(): Promise<IssueRow[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  return (data ?? []).filter((r) => (seen.has(r.aor) ? false : (seen.add(r.aor), true)));
}

export async function latestIssueFor(aor: Aor): Promise<IssueRow | null> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('aor', aor)
    .order('issue_number', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function issueBySerial(serial: string): Promise<IssueRow | null> {
  const { data, error } = await supabase.from('issues').select('*').eq('serial', serial).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}
