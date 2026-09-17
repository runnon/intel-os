import ms from 'milsymbol';
import { eventSidc, IDENTITY_COLOR, type BaseOperator, type TheaterEvent } from '@intel-os/core';

/**
 * MIL-STD-2525E symbol rendering via milsymbol (GEO-3/GEO-4).
 * Returns SVG data URLs keyed by SIDC so the map registers each distinct
 * symbol once. Region-precision events get a dashed frame (status digit 1
 * in the SIDC drives this — DATA-3 visual distinction).
 */

const cache = new Map<string, { url: string; width: number; height: number }>();

export function symbolFor(ev: Pick<TheaterEvent, 'affiliation' | 'category' | 'precision'>): {
  sidc: string;
  url: string;
  width: number;
  height: number;
} {
  // Map display renders the affiliation FRAME only (reserved entity 110000 —
  // no interior icon art) so the event serial can sit centered inside the
  // symbol, proof-build style. GEO-4 explicitly sanctions framing-only display.
  const sidc = eventSidc(ev).slice(0, 10) + '1100000000';
  const cached = cache.get(sidc);
  if (cached) return { sidc, ...cached };
  const symbol = new ms.Symbol(sidc, {
    size: 22,
    outlineWidth: 2,
    outlineColor: 'rgba(10,14,18,0.9)',
    // Pin the affiliation fill to the 2525E Light set so the legends (which use
    // IDENTITY_COLOR_LIGHT) match the plotted symbols exactly.
    colorMode: 'Light',
  });
  const { width, height } = symbol.getSize();
  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(symbol.asSVG())))}`;
  const entry = { url, width, height };
  cache.set(sidc, entry);
  return { sidc, ...entry };
}

// MIL-STD-2525 Land Installations (symbol set 20) framed by operator. The frame
// affiliation distinguishes US/coalition (friendly), host-nation (neutral),
// adversary (hostile) and unknown — the standard installation representation.
const OPERATOR_AFFILIATION: Record<BaseOperator, string> = {
  us: '3', // friendly
  host: '4', // neutral
  adversary: '6', // hostile
  unknown: '1', // unknown
};

export function installationSymbolFor(operator: BaseOperator): {
  sidc: string;
  url: string;
  width: number;
  height: number;
} {
  // Symbol set 20 (Land Installations), generic entity 000000 → the frame + the black
  // installation amplifier (no interior icon), so it reads as an installation and stays
  // visually distinct from the event frames.
  const sidc = `100${OPERATOR_AFFILIATION[operator]}2000000000000000`;
  const cached = cache.get(sidc);
  if (cached) return { sidc, ...cached };
  const symbol = new ms.Symbol(sidc, {
    size: 16, // smaller than events (22) so incidents stay dominant
    outlineWidth: 2,
    outlineColor: 'rgba(10,14,18,0.9)',
    colorMode: 'Light',
  });
  const { width, height } = symbol.getSize();
  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(symbol.asSVG())))}`;
  const entry = { url, width, height };
  cache.set(sidc, entry);
  return { sidc, ...entry };
}

export const AFFILIATION_COLOR = IDENTITY_COLOR;
