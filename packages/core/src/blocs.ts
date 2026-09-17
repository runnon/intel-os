import type { Aor } from './types';

/**
 * Curated alliance / bloc reference layer, per combatant command.
 *
 * PURPOSE: let a reader see declared alignment — "who belongs to which bloc" —
 * as a stable factual backdrop under the events. This is CONTEXT, not analysis.
 *
 * HARD RULES (this is why it doesn't break AUTO-5 / DATA-4):
 *  - Every `member` assignment is grounded in a NAMED, public organisation or
 *    treaty (the `basis` field): NATO, CSTO, GCC, the Quad/AUKUS, ASEAN, ECOWAS,
 *    the Sahel Alliance (AES), USMCA, ALBA, or US Major-Non-NATO-Ally status.
 *    We never encode "who would side with whom in a war" — that is an assessment.
 *  - Genuinely fluid / disputed alignment is marked `contested` and rendered as
 *    hatching, never as solid membership. When there is no factual basis for a
 *    lean, the country is simply omitted (renders unshaded) — the DATA-4 instinct:
 *    uncertain resolves to "unknown", it is not guessed.
 *  - This is HAND-CURATED reference data owned by the maintainer (like the
 *    gazetteer). It is NOT produced by the unattended ingest path.
 *
 * `country` strings match Natural Earth `ADMIN` names so the polygons join cleanly.
 * Colours are a muted family (slate ≈ US-aligned bloc, rust ≈ US-rival bloc,
 * taupe ≈ regional body) held clear of the MIL-STD affiliation hues so a shaded
 * country never reads as an event affiliation.
 */

export type BlocCertainty = 'member' | 'contested';

export interface BlocDef {
  key: string;
  label: string;
  color: string;
}

export interface CountryAlignment {
  country: string; // Natural Earth ADMIN name
  blocKey: string;
  certainty: BlocCertainty;
  basis: string; // the named organisation / treaty this is grounded in
}

export interface AorBlocs {
  blocs: BlocDef[];
  alignments: CountryAlignment[];
}

// Distinct muted hues — blue / orange / green so the three bloc families read apart
// at a glance, while staying clear of the saturated MIL-STD affiliation colors.
const SLATE = '#5b6fb0'; // US-aligned bloc family (indigo-blue)
const RUST = '#b26a3d'; // US-rival bloc family (terracotta)
const TAUPE = '#7d8a3c'; // regional body / other (olive)

const NATO_MEMBERS = [
  'Albania', 'Belgium', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia',
  'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia',
  'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway',
  'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Turkey',
  'United Kingdom',
];

const m = (country: string, blocKey: string, basis: string): CountryAlignment => ({
  country,
  blocKey,
  certainty: 'member',
  basis,
});
const c = (country: string, blocKey: string, basis: string): CountryAlignment => ({
  country,
  blocKey,
  certainty: 'contested',
  basis,
});

export const BLOCS: Record<Aor, AorBlocs> = {
  EUCOM: {
    blocs: [
      { key: 'nato', label: 'NATO', color: SLATE },
      { key: 'csto', label: 'CSTO', color: RUST },
    ],
    alignments: [
      ...NATO_MEMBERS.map((country) => m(country, 'nato', 'NATO member')),
      m('Russia', 'csto', 'CSTO member'),
      m('Belarus', 'csto', 'CSTO member'),
      c('Armenia', 'csto', 'CSTO member (participation frozen 2024)'),
      c('Ukraine', 'nato', 'NATO aspirant; NATO–Ukraine Council'),
      c('Georgia', 'nato', 'NATO aspirant (2008 Bucharest pledge)'),
      c('Bosnia and Herzegovina', 'nato', 'NATO Membership Action Plan'),
      // Non-aligned (declared neutral) are intentionally omitted → unshaded:
      // Switzerland, Austria, Ireland, Serbia, Moldova.
    ],
  },
  CENTCOM: {
    blocs: [
      { key: 'gcc', label: 'GCC', color: TAUPE },
      { key: 'us_ally', label: 'US treaty ally / MNNA', color: SLATE },
      { key: 'iran', label: 'Iran', color: RUST },
    ],
    alignments: [
      m('Saudi Arabia', 'gcc', 'Gulf Cooperation Council'),
      m('United Arab Emirates', 'gcc', 'Gulf Cooperation Council'),
      m('Qatar', 'gcc', 'Gulf Cooperation Council'),
      m('Kuwait', 'gcc', 'Gulf Cooperation Council'),
      m('Bahrain', 'gcc', 'Gulf Cooperation Council'),
      m('Oman', 'gcc', 'Gulf Cooperation Council'),
      m('Israel', 'us_ally', 'US Major Non-NATO Ally'),
      m('Jordan', 'us_ally', 'US Major Non-NATO Ally'),
      m('Egypt', 'us_ally', 'US Major Non-NATO Ally'),
      m('Pakistan', 'us_ally', 'US Major Non-NATO Ally'),
      m('Iran', 'iran', 'State'),
      c('Iraq', 'iran', 'Iran-aligned armed factions; state alignment contested'),
      c('Lebanon', 'iran', 'Hezbollah influence; state alignment contested'),
      c('Yemen', 'iran', 'Houthi control of the north; contested'),
      // Omitted (no clear current basis → unshaded): Syria (post-2024 transition),
      // Afghanistan.
    ],
  },
  INDOPACOM: {
    blocs: [
      { key: 'us_ally', label: 'US treaty ally / Quad', color: SLATE },
      { key: 'prc', label: 'China-aligned', color: RUST },
      { key: 'asean', label: 'ASEAN (non-aligned)', color: TAUPE },
    ],
    alignments: [
      m('Japan', 'us_ally', 'US–Japan Security Treaty'),
      m('South Korea', 'us_ally', 'US–ROK Mutual Defense Treaty'),
      m('Australia', 'us_ally', 'ANZUS / AUKUS'),
      m('Philippines', 'us_ally', 'US–Philippines Mutual Defense Treaty'),
      m('Thailand', 'us_ally', 'US Major Non-NATO Ally'),
      m('New Zealand', 'us_ally', 'ANZUS'),
      m('China', 'prc', 'State'),
      m('North Korea', 'prc', 'DPRK–PRC Treaty'),
      m('Indonesia', 'asean', 'ASEAN member'),
      m('Malaysia', 'asean', 'ASEAN member'),
      m('Vietnam', 'asean', 'ASEAN member'),
      c('India', 'us_ally', 'Quad partner; non-aligned tradition'),
      c('Myanmar', 'prc', 'PRC economic/military ties; contested civil war'),
    ],
  },
  AFRICOM: {
    blocs: [
      { key: 'ecowas', label: 'ECOWAS', color: TAUPE },
      { key: 'aes', label: 'Sahel Alliance (AES)', color: RUST },
    ],
    alignments: [
      m('Nigeria', 'ecowas', 'ECOWAS member'),
      m('Ghana', 'ecowas', 'ECOWAS member'),
      m('Senegal', 'ecowas', 'ECOWAS member'),
      m('Mali', 'aes', 'Alliance of Sahel States'),
      m('Niger', 'aes', 'Alliance of Sahel States'),
      m('Burkina Faso', 'aes', 'Alliance of Sahel States'),
      // AFRICOM is deliberately sparse: most states have no single declared bloc
      // and are left unshaded rather than guessed.
    ],
  },
  NORTHCOM: {
    blocs: [
      { key: 'nato', label: 'NATO', color: SLATE },
      { key: 'usmca', label: 'USMCA partner', color: TAUPE },
    ],
    alignments: [
      m('United States of America', 'nato', 'NATO member'),
      m('Canada', 'nato', 'NATO member'),
      m('Mexico', 'usmca', 'USMCA'),
    ],
  },
  SOUTHCOM: {
    blocs: [
      { key: 'us_ally', label: 'US ally / MNNA', color: SLATE },
      { key: 'alba', label: 'ALBA', color: RUST },
    ],
    alignments: [
      m('Colombia', 'us_ally', 'US Major Non-NATO Ally'),
      m('Venezuela', 'alba', 'ALBA member'),
      m('Cuba', 'alba', 'ALBA member'),
      m('Nicaragua', 'alba', 'ALBA member'),
      m('Bolivia', 'alba', 'ALBA member'),
      // Non-aligned (Brazil, Argentina, Chile, Peru, …) intentionally unshaded.
    ],
  },
};

/** The declared alignment for a country in an AOR, or null if none is curated. */
export function alignmentFor(aor: Aor, country: string): CountryAlignment | null {
  return BLOCS[aor].alignments.find((a) => a.country === country) ?? null;
}
