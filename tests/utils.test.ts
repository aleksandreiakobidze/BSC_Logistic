import { describe, expect, it } from "vitest";
import { formatCurrency, generateTrackingCode, initials, slugify } from "../lib/utils";

describe("lib/utils", () => {
  it("formats currency with default USD", () => {
    expect(formatCurrency(1234.5)).toMatch(/1,234\.50/);
  });

  it("generates tracking codes of expected shape", () => {
    const code = generateTrackingCode();
    expect(code).toMatch(/^BSC-[A-Z0-9]{10}$/);
  });

  it("slugifies multi-word names", () => {
    expect(slugify("BSC Logistics LLC!")).toBe("bsc-logistics-llc");
  });

  it("extracts readable initials", () => {
    expect(initials("Alice Wonderland")).toBe("AW");
    expect(initials("Bob")).toBe("B");
  });
});
