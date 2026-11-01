import { describe, expect, it } from "vitest";
import { PRICING, formatNaira, newReference } from "@/lib/pricing";

/**
 * Money rules. `taxPortion` reads a setting from the database, so it is covered
 * by the quote/logic suite; the constants and formatting are pure.
 */

describe("PRICING", () => {
  it("stores whole kobo, never floats", () => {
    for (const tier of Object.values(PRICING)) {
      expect(Number.isInteger(tier.amountKobo)).toBe(true);
      expect(tier.amountKobo % 100).toBe(0);
    }
  });

  it("keeps the published prices the site advertises", () => {
    expect(PRICING.priority.amountKobo).toBe(400_000); // ₦4,000
    expect(PRICING.private.amountKobo).toBe(2_500_000); // ₦25,000
  });
});

describe("formatNaira", () => {
  it("renders whole naira without decimals", () => {
    const formatted = formatNaira(2_500_000);
    expect(formatted).toContain("25,000");
    expect(formatted).not.toContain(".00");
  });

  it("rounds half-kobo rather than printing fractions", () => {
    expect(formatNaira(400_050)).toContain("4,001");
  });
});

describe("newReference", () => {
  it("namespaces the reference by request and keeps it unique", () => {
    const a = newReference("REQ-1013");
    const b = newReference("REQ-1013");
    expect(a.startsWith("IWL-1013-")).toBe(true);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^IWL-1013-[0-9A-Z]+$/);
  });
});
