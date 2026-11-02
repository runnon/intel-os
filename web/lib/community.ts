// Community reports: events sent in by signed-in users. They live on their own
// clearly labeled, off-by-default map layer and are never folded into a situation
// update (see docs/DECISIONS.md, 2026-10-30 "Community reports layer").
//
// Shared by the API route (validation, placement) and the client (types, copy).

import type { Aor } from "@intel-os/core";
import { AORS, GAZETTEERS, assertPublicSource, geolocate } from "@intel-os/core";

// Community layer color: purple, outside the MIL-STD affiliation palette and the
// context-site colors, so a community dot can never be mistaken for an event symbol.
export const COMMUNITY_COLOR = "#6a3d9a";

export const COMMUNITY_LIMITS = {
  title: [8, 140],
  summary: 1000,
  place: [2, 120],
  country: 60,
  url: 2000,
  maxAgeDays: 30,
} as const;

export interface CommunityInput {
  aor: Aor;
  title: string;
  summary: string;
  placeName: string;
  country: string;
  occurredAt: string; // ISO
  sourceUrl: string;
}

/** A report as the site shows it: coordinates come from the gazetteer, never the submitter. */
export interface CommunityReport {
  id: string;
  createdAt: string;
  aor: Aor;
  title: string;
  summary: string;
  placeName: string;
  country: string;
  occurredAt: string;
  sourceUrl: string;
  sourceHost: string;
  mine: boolean;
  flagged: boolean;
  lat: number | null;
  lon: number | null;
  precision: "point" | "settlement" | "region";
}

/** Row shape returned by public_community_reports(). */
export interface CommunityRow {
  id: string;
  created_at: string;
  aor: Aor;
  title: string;
  summary: string;
  place_name: string;
  country: string;
  occurred_at: string;
  source_url: string;
  mine: boolean;
  flagged: boolean;
}

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

// Private, link-local and internal hosts the SQL check also refuses; assertPublicSource
// covers the core set, this adds what a person could paste that a feed never would.
const NON_PUBLIC_HOST = /^(0\.|169\.254\.|\[)|\.(internal|lan|corp|home)$/;

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Plain-English check of a public source link; null when it is acceptable. */
export function sourceProblem(url: string): string | null {
  if (!url) return "Add a link to a public source (a news article, official statement, or public post).";
  if (url.length > COMMUNITY_LIMITS.url) return "That link is too long.";
  try {
    assertPublicSource(url);
  } catch {
    return "Use a public web link starting with https:// — not a file, private address, or internal site.";
  }
  const u = new URL(url);
  if (NON_PUBLIC_HOST.test(u.hostname.toLowerCase()) || !u.hostname.includes(".")) {
    return "Use a public web link starting with https:// — not a file, private address, or internal site.";
  }
  if (u.username || u.password) return "Remove the username or password from the link.";
  return null;
}

export type Validation = { ok: true; value: CommunityInput } | { ok: false; error: string; field?: string };

export function validateCommunityInput(body: unknown, now: Date = new Date()): Validation {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const aor = clean(b.aor).toUpperCase();
  if (!(AORS as readonly string[]).includes(aor)) return { ok: false, error: "Pick a theater.", field: "aor" };

  const title = clean(b.title);
  const [tMin, tMax] = COMMUNITY_LIMITS.title;
  if (title.length < tMin) return { ok: false, error: "Give the report a short headline (at least 8 characters).", field: "title" };
  if (title.length > tMax) return { ok: false, error: `Keep the headline under ${tMax} characters.`, field: "title" };

  const summary = typeof b.summary === "string" ? b.summary.trim() : "";
  if (summary.length > COMMUNITY_LIMITS.summary) {
    return { ok: false, error: `Keep the details under ${COMMUNITY_LIMITS.summary} characters.`, field: "summary" };
  }

  const placeName = clean(b.placeName);
  const [pMin, pMax] = COMMUNITY_LIMITS.place;
  if (placeName.length < pMin || placeName.length > pMax) {
    return { ok: false, error: "Say where it happened (a city, base, or area).", field: "placeName" };
  }
  const country = clean(b.country);
  if (country.length > COMMUNITY_LIMITS.country) return { ok: false, error: "That country name is too long.", field: "country" };

  const at = new Date(clean(b.occurredAt));
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Say when it happened.", field: "occurredAt" };
  if (at.getTime() > now.getTime() + 60 * 60 * 1000) {
    return { ok: false, error: "That time is in the future.", field: "occurredAt" };
  }
  if (at.getTime() < now.getTime() - COMMUNITY_LIMITS.maxAgeDays * 86_400_000) {
    return { ok: false, error: `Community reports cover the last ${COMMUNITY_LIMITS.maxAgeDays} days.`, field: "occurredAt" };
  }

  const sourceUrl = clean(b.sourceUrl);
  const problem = sourceProblem(sourceUrl);
  if (problem) return { ok: false, error: problem, field: "sourceUrl" };

  return {
    ok: true,
    value: { aor: aor as Aor, title, summary, placeName, country, occurredAt: at.toISOString(), sourceUrl },
  };
}

/**
 * Where a report plots: the curated gazetteer for its theater, the same resolver the
 * pipeline uses. No match means listed without a point — never a guessed coordinate.
 */
export function placeReport(aor: Aor, placeName: string, country: string) {
  const geo = geolocate(placeName, country || undefined, GAZETTEERS[aor]);
  if (!geo.validated || geo.lat == null || geo.lon == null) {
    return { lat: null, lon: null, precision: "region" as const, matchedName: null };
  }
  return { lat: geo.lat, lon: geo.lon, precision: geo.precision, matchedName: geo.matchedName };
}

/** DB row → displayed report. Rows whose link fails today's source check are dropped. */
export function toCommunityReport(row: CommunityRow): CommunityReport | null {
  if (sourceProblem(row.source_url)) return null;
  const place = placeReport(row.aor, row.place_name, row.country);
  return {
    id: row.id,
    createdAt: row.created_at,
    aor: row.aor,
    title: row.title,
    summary: row.summary,
    placeName: row.place_name,
    country: row.country,
    occurredAt: row.occurred_at,
    sourceUrl: row.source_url,
    sourceHost: sourceHost(row.source_url),
    mine: row.mine,
    flagged: row.flagged,
    lat: place.lat,
    lon: place.lon,
    precision: place.precision,
  };
}

/** Postgres errors from the insert guard → what to tell the person. */
export function friendlyCommunityError(e: { code?: string; message?: string } | null): { status: number; error: string } {
  const code = e?.code ?? "";
  const m = (e?.message ?? "").toLowerCase();
  if (code === "P0429" || m.includes("rate limit")) {
    return { status: 429, error: "You've sent several reports recently. Try again in a little while." };
  }
  if (code === "23505" || m.includes("duplicate")) {
    return { status: 409, error: "You've already submitted this link this week." };
  }
  if (code === "23514" || code === "22023") {
    return { status: 400, error: "Something in the report wasn't accepted. Check the link and the time, then try again." };
  }
  if (code === "42501") return { status: 401, error: "Sign in to submit a report." };
  return { status: 502, error: "Couldn't save the report just now. Try again." };
}
