import "server-only";
import { PostHog } from "posthog-node";

// Server-side product analytics. Capture happens only from API routes — never a browser
// script — so the deployed app stays CDN-free (NFR-4/5). It's a NO-OP unless POSTHOG_KEY
// is set, so the gov/NIPRNet build simply leaves it unconfigured and emits nothing.
let client: PostHog | null = null;

function ph(): PostHog | null {
  if (client) return client;
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;
  client = new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/**
 * Record a product event against a stable person (the Supabase user id, so PostHog
 * persons line up with app users). Flushes before returning — serverless instances can
 * freeze after the response, which would otherwise drop the event.
 */
export async function track(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
  setPersonProps?: Record<string, unknown>,
): Promise<void> {
  const c = ph();
  if (!c) return;
  try {
    c.capture({
      distinctId,
      event,
      properties: { ...properties, ...(setPersonProps ? { $set: setPersonProps } : {}) },
    });
    await c.flush();
  } catch {
    // Analytics must never break a user flow.
  }
}
