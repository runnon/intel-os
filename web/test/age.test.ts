import { describe, expect, it } from 'vitest';
import { ageLabel, plainUtc } from '../lib/age';

const CUTOFF = '2026-10-30T12:01:26Z';
const at = (iso: string) => new Date(iso).getTime();

describe('cut-off age label', () => {
  it('reads minutes, hours, then days', () => {
    expect(ageLabel(CUTOFF, at('2026-10-30T12:01:50Z'))).toBe('just now');
    expect(ageLabel(CUTOFF, at('2026-10-30T12:43:30Z'))).toBe('42m ago');
    expect(ageLabel(CUTOFF, at('2026-10-30T17:30:00Z'))).toBe('5h ago');
    expect(ageLabel(CUTOFF, at('2026-11-01T11:00:00Z'))).toBe('46h ago');
    expect(ageLabel(CUTOFF, at('2026-11-02T13:00:00Z'))).toBe('3d ago');
  });

  it('never shows a negative age under clock skew', () => {
    expect(ageLabel(CUTOFF, at('2026-10-30T11:58:00Z'))).toBe('just now');
  });
});

describe('plain UTC date', () => {
  it('spells out the year so it cannot be read as a day', () => {
    expect(plainUtc(CUTOFF)).toBe('30 Oct 2026, 12:01 UTC');
  });
});
