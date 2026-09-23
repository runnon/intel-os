import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MARKING_LINE } from "@/lib/analyst-policy";

// Decision 2026-09-22 (docs/DECISIONS.md): the product carries NO classification
// markings. "UNCLASSIFIED" banners and "(U)" portion marks read as output of a
// government classification system and were taken by outsiders as a sign we were
// publishing marked-down classified material. The MARK-2 open-sources / not-official
// statement stays; the classification vocabulary does not.
const CLASSIFICATION_MARKING = /\bUNCLASSIFIED\b|\(U\)|\bCUI\b|\bSECRET\b/i;

const MARKING_BEARING_FILES = [
  "app/layout.tsx",
  "app/page.tsx",
  "app/api/analyst/route.ts",
  "components/ReportSheet.tsx",
  "lib/analyst-policy.ts",
];

describe("markings", () => {
  it("keeps the open-sources / not-official statement on the analyst marking line", () => {
    expect(MARKING_LINE).toContain("OPEN SOURCES ONLY");
    expect(MARKING_LINE).toContain("NOT AN OFFICIAL GOVERNMENT PRODUCT");
  });

  it("carries no classification marking on any marking-bearing surface", () => {
    for (const file of MARKING_BEARING_FILES) {
      const source = readFileSync(path.resolve(__dirname, "..", file), "utf8");
      // Strip comments: the source may EXPLAIN the rule; it must not RENDER a marking.
      const rendered = source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const hit = rendered.match(CLASSIFICATION_MARKING);
      expect(hit, `${file} renders a classification marking: ${hit?.[0]}`).toBeNull();
    }
  });
});
