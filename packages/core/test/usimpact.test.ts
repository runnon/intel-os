import { describe, expect, it } from 'vitest';
import { factualUsImpact } from '../src/usimpact';

describe('factualUsImpact (AUTO-5)', () => {
  it.each([
    'Two US service members were wounded.',
    'Flights at Al Udeid Air Base were suspended for six hours',
    'NORAD F-16s were scrambled to intercept a TFR-violating aircraft near Camp David.',
    'US forces have completed their withdrawal from Erbil Air Base.',
  ])('keeps a reported fact: %s', (t) => {
    expect(factualUsImpact(t)).toBeTruthy();
  });

  it('trims a trailing evaluative clause and keeps the fact', () => {
    expect(
      factualUsImpact('U.S. Marines conducted bilateral EOD training with Thai counterparts, strengthening partner capacity in the region.'),
    ).toBe('U.S. Marines conducted bilateral EOD training with Thai counterparts.');
    expect(
      factualUsImpact('A US aircrew was shot down over Iran and rescued, marking a significant escalation inside Iranian territory.'),
    ).toBe('A US aircrew was shot down over Iran and rescued.');
  });

  it.each([
    'Disruption to navigation through the Bab al-Mandeb strait could affect US naval transit.',
    'Potential disruption to maritime traffic through the Strait of Hormuz, a critical waterway.',
    'Houthi control of Mokha increases the threat to US and allied naval vessels.',
    'US military presence in Greenland is set to expand significantly.',
    'Iran\'s public threats raise the threat level for US forces across the AOR.',
    'Kills the only non-Hormuz crude route; Iraqi launch axis is new.',
    'Raid volume is a magazine-depth problem, not an intercept one.',
    'Civilian casualties are the main IO threat to basing consent.',
  ])('withholds assessment: %s', (t) => {
    expect(factualUsImpact(t)).toBeUndefined();
  });

  it('handles empty input', () => {
    expect(factualUsImpact('')).toBeUndefined();
    expect(factualUsImpact(undefined)).toBeUndefined();
    expect(factualUsImpact(null)).toBeUndefined();
  });
});
