import type Anthropic from '@anthropic-ai/sdk';
import type { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import { makeModel } from './model';
import { randomUUID } from 'node:crypto';
import type { Aor, TheaterEvent } from '@intel-os/core';
import { geolocate } from '@intel-os/core';
import type { Article } from './feeds';

/**
 * LLM extraction: article batch → candidate theater events.
 * The extractor NEVER invents coordinates (AUTO-3/DATA-2: geolocation happens
 * against the gazetteer afterwards) and never guesses attribution (DATA-4:
 * the schema forces contested attribution to 'unknown').
 */

export type ExtractorFn = (articles: Article[], aor: Aor) => Promise<TheaterEvent[]>;

const EVENT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        additionalProperties: false,
        required: [
          'title', 'summary', 'occurredAt', 'category', 'affiliation',
          'placeName', 'country', 'confOrigin', 'confActor', 'usForcesFlag',
          'usImpact', 'sourceUrls',
        ],
        properties: {
          title: { type: 'string' as const, description: 'Short factual headline for the event' },
          summary: { type: 'string' as const, description: '1-3 sentences of reported facts only, no analysis' },
          occurredAt: { type: 'string' as const, description: 'Best-known event date/time, ISO 8601' },
          category: { enum: ['strike', 'ground', 'maritime', 'infrastructure', 'air-defense', 'movement', 'political', 'other'] },
          affiliation: {
            enum: ['hostile', 'friendly', 'neutral', 'unknown'],
            description: "Actor conducting the action relative to US forces. Contested, unclaimed, or single-belligerent-only attribution MUST be 'unknown' — never guess.",
          },
          placeName: { type: 'string' as const, description: 'Most specific named place in the reporting (base, city, strait). Empty string if none.' },
          country: { type: 'string' as const, description: 'Country of the event, or empty string' },
          confOrigin: { enum: ['high', 'moderate', 'low'], description: 'Confidence in WHERE it happened, from source quality' },
          confActor: { enum: ['high', 'moderate', 'low'], description: 'Confidence in WHO did it' },
          usForcesFlag: { type: 'boolean' as const, description: 'True if US personnel, bases, aircraft, ships, or infrastructure are directly threatened or affected' },
          usImpact: { type: 'string' as const, description: 'One sentence on impact to US operations, or empty string' },
          sourceUrls: { type: 'array' as const, items: { type: 'string' as const }, description: 'URLs of the input articles this event derives from' },
        },
      },
    },
  },
};

const SYSTEM = `You are an OSINT triage assistant supporting an unclassified, publicly-releasable theater situation update. From a batch of news items, extract discrete military/security EVENTS relevant to the given combatant command area of responsibility.

Rules:
- Reported facts only. No analysis, no judgements, no predictions (those belong to a signed product, not this one).
- One event per real-world incident; merge multiple articles about the same incident into one event listing all source URLs.
- Discard items that are not concrete events in the AOR (opinion pieces, background explainers, unrelated regions).
- Attribution discipline: if the perpetrator is contested, unclaimed, or asserted only by one belligerent, affiliation is "unknown". "hostile" = forces adversarial to the US in this theater conducting an action; "friendly" = US/coalition action; "neutral" = third parties.
- Confidence reflects sourcing: named officials/multiple outlets = high; single credible outlet = moderate; belligerent state media only = low.
- occurredAt: use the reported event time; if only the publication date is known, use that.`;

export function makeClaudeExtractor(override?: { client: Anthropic | AnthropicBedrock; model: string }): ExtractorFn {
  const { client: anthropic, model } = override ?? makeModel();
  return async (articles, aor) => {
    if (articles.length === 0) return [];
    const batch = articles.slice(0, 80).map((a, i) =>
      `[${i}] ${a.title}\n    outlet: ${a.outlet} | published: ${a.publishedAt}\n    url: ${a.url}${a.summary ? `\n    summary: ${a.summary}` : ''}`,
    ).join('\n');

    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: EVENT_SCHEMA } },
      messages: [{ role: 'user', content: `AOR: ${aor}\n\nNews items:\n${batch}` }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('extraction refused by model safety layer');
    }
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('extraction returned no content');
    const parsed = JSON.parse(textBlock.text) as { events: any[] };

    const now = new Date().toISOString();
    return parsed.events.map((e): TheaterEvent => {
      const geo = geolocate(e.placeName ?? '', e.country || undefined);
      const sources = (e.sourceUrls ?? [])
        .map((url: string) => articles.find((a) => a.url === url))
        .filter(Boolean)
        .map((a: Article) => ({ url: a.url, outlet: a.outlet, title: a.title, publishedAt: a.publishedAt }));
      return {
        id: randomUUID(),
        aor,
        title: e.title,
        summary: e.summary,
        occurredAt: safeIso(e.occurredAt, now),
        reportedAt: sources[0]?.publishedAt ?? now,
        category: e.category,
        affiliation: e.affiliation,
        placeName: e.placeName || e.country || 'Unspecified',
        country: e.country || undefined,
        lat: geo.lat,
        lon: geo.lon,
        precision: geo.precision,
        geomValidated: geo.validated,
        geoConfidence: geo.confidence,
        confOrigin: e.confOrigin,
        confActor: e.confActor,
        usForcesFlag: e.usForcesFlag,
        usImpact: e.usImpact || undefined,
        sources: sources.length > 0 ? sources : [],
        revisions: [],
      };
    }).filter((e) => e.sources.length > 0); // DATA-1: no source, no event
  };
}

function safeIso(s: string, fallback: string): string {
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d.toISOString();
}
