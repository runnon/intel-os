import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { siteUrl, TRIAL_DAYS } from "@/lib/stripe";

afterEach(() => vi.unstubAllEnvs());

describe("billing configuration", () => {
  it("uses a seven-day trial", () => {
    expect(TRIAL_DAYS).toBe(7);
  });

  it("accepts a configured HTTPS origin and strips paths", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://intel-os.example/some/path");
    expect(siteUrl()).toBe("https://intel-os.example");
  });

  it("rejects insecure non-local billing origins", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://intel-os.example");
    expect(() => siteUrl()).toThrow(/HTTPS/);
  });
});
