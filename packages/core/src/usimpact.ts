/**
 * AUTO-5 guard for the extracted "US impact" line.
 *
 * The extractor is asked for a reported, direct effect on US forces ("Two US service
 * members were wounded", "Flights at Al Udeid were suspended"). In practice about
 * half of the stored lines carried assessment instead: significance ("a critical
 * chokepoint"), consequence ("could affect US naval transit"), or evaluation
 * ("strengthening interoperability"). That is judgement in the unattended path, so the
 * line is shown only when it reads as a reported fact.
 *
 * Two deterministic steps, no model:
 *  1. trim a trailing evaluative clause (", strengthening bilateral interoperability")
 *     — the fact before it stands on its own;
 *  2. withhold the whole line if any assessment marker remains (modal / predictive
 *     verbs, risk-and-threat framing, significance words, evaluative verbs).
 * False negatives (a factual line withheld) cost little; a leak costs the invariant.
 * Applied when the worker stores an event AND when the web renders one, so issues
 * published before this guard (immutable, AUTO-10) display clean too.
 */

const EVALUATIVE_TAIL =
  /,\s*(?:(?:directly|further|thereby|significantly|thus)\s+)?(?:enhancing|strengthening|demonstrating|reinforcing|underscoring|highlighting|signall?ing|reflecting|bolstering|improving|deepening|boosting|advancing|supporting|showcasing|testing|expanding|increasing|raising|affecting|complicating|undermining|degrading|straining|threatening|posing|marking|adding|representing|maintaining|advancing|ending|ensuring|enabling|concluding|shifting)\b[^.;]*\.?\s*$/i;

const ASSESSMENT =
  /\b(?:could|may|might|would|should|will|likely|unlikely|probabl\w*|potential\w*|possibl\w*|expected|anticipat\w*|set to|risks?|threat(?:s|en|ens|ening)?|implicat\w*|signal\w*|reflect\w*|suggest\w*|indicat\w*|concern\w*|pressure\w*|escalat\w*|complicat\w*|undermin\w*|degrad\w*|strain\w*|significan\w*|critical|key|vulnerab\w*|expos(?:es|ing)|compromis\w*|alter\w*|calculus|posture|controvers\w*|scrutiny|tension\w*|strengthen\w*|enhanc\w*|reinforc\w*|bolster\w*|demonstrat\w*|underscor\w*|highlight\w*|interoperab\w*|affect|affects|affecting|raises?|raising|increases?|increasing|reduces?|reducing|limits?|limiting|opens?|drives?|means|matters?|importan\w*|strategic\w*|readiness gains?|capabilit(?:y|ies) gap|problem|challenge\w*|dimension|objectives?|interests?|represent\w*|maintain\w*|advanc\w*|expand\w*|proficiency|driven by|supports?)\b/i;

// Subject-less evaluative fragments ("Kills the only non-Hormuz route", "Opens a southern front").
const FRAGMENT = /^(?:kills|expands|opens|drives|adds|degrades|ranged|forces sustained)\b/i;

const MIN_LEN = 12;

/** The reported-fact form of a US-impact line, or undefined to withhold it. */
export function factualUsImpact(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  let t = text.replace(/\s+/g, ' ').trim();
  t = t.replace(EVALUATIVE_TAIL, '').trim();
  if (t.length < MIN_LEN) return undefined;
  if (ASSESSMENT.test(t) || FRAGMENT.test(t)) return undefined;
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}
