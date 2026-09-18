import "server-only";
import { PostHog } from "posthog-node";

// Server-side product analytics. Capture happens only from API routes — never a browser
// script — so the deployed app stays CDN-free (NFR-4/5). It's a NO-OP unless POSTHOG_KEY
// is set, so the gov/NIPRNet build simply leaves it unconfigured and emits nothing.
let client: PostHog | null = null;

function ph(): PostHog | null {
  if (client) return client;
  const key = process.env.POSTHOG_KEY?.trim();
  const host = process.env.POSTHOG_HOST?.trim();
  if (!key || !host) return null;
  client = new PostHog(key, {
    host,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/**
 * Record a product event against a stable opaque person id. Route handlers schedule
 * this with Next's after(), then flush so a serverless instance cannot drop the event.
 */
export async function track(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const c = ph();
  if (!c) return;
  try {
    c.capture({
      distinctId,
      event,
      properties,
    });
    await c.flush();
  } catch {
    // Analytics must never break a user flow.
  }
}
