import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath", () => {
  it("keeps local paths, searches, and fragments", () => {
    expect(safeInternalPath("/analyst?from=archive#top")).toBe("/analyst?from=archive#top");
    expect(safeInternalPath("/i/SU-CEN-26-001")).toBe("/i/SU-CEN-26-001");
  });

  it("rejects external and ambiguous redirects", () => {
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", null]) {
      expect(safeInternalPath(value)).toBe("/analyst");
    }
  });
});
