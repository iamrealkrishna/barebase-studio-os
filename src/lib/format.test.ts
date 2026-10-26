import { describe, expect, it } from "vitest";

import { amountInWords, formatDate, formatINR, formatRelative, formatTime } from "./format";

// The cases in UI spec section 7, "Test cases the formatters must pass".
describe("UI spec section 7 formatter cases", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatINR("1234567")).toBe("₹12,34,567");
  });

  it("formats rupees with paise", () => {
    expect(formatINR("1234567.5", { paise: true })).toBe("₹12,34,567.50");
  });

  it.each([
    ["100000", "One lakh rupees"],
    ["1000000", "Ten lakh rupees"],
    ["10000000", "One crore rupees"],
    ["240000", "Two lakh forty thousand rupees"],
    ["1860.50", "One thousand eight hundred sixty rupees and fifty paise"],
  ])("amountInWords(%s)", (input, expected) => {
    expect(amountInWords(input)).toBe(expected);
  });

  it("shows date and time in India time", () => {
    const d = new Date("2026-10-08T08:35:00Z");
    expect(formatDate(d)).toBe("08 Oct 2026");
    expect(formatTime(d)).toBe("2:05 pm");
  });
});

describe("formatINR edge cases", () => {
  it.each([
    ["0", "₹0"],
    ["999", "₹999"],
    ["1000", "₹1,000"],
    ["834675", "₹8,34,675"],
    ["20524268", "₹2,05,24,268"],
    ["-5000", "-₹5,000"],
    ["99.5", "₹100"],
    ["99.49", "₹99"],
  ])("formatINR(%s)", (input, expected) => {
    expect(formatINR(input)).toBe(expected);
  });

  it("rounds paise half up without floating point", () => {
    expect(formatINR("0.005", { paise: true })).toBe("₹0.01");
    expect(formatINR("9.995", { paise: true })).toBe("₹10.00");
    expect(formatINR("12345678901234.56", { paise: true })).toBe("₹1,23,45,67,89,01,234.56");
  });

  it("refuses something that isn't an amount", () => {
    expect(() => formatINR("12,000")).toThrow();
    expect(() => formatINR("")).toThrow();
  });
});

describe("amountInWords, more cases", () => {
  it.each([
    ["0", "Zero rupees"],
    ["1", "One rupee"],
    ["98491", "Ninety eight thousand four hundred ninety one rupees"],
    ["1421900", "Fourteen lakh twenty one thousand nine hundred rupees"],
    ["64000", "Sixty four thousand rupees"],
    ["1000000000", "One hundred crore rupees"],
    ["0.75", "Zero rupees and seventy five paise"],
  ])("amountInWords(%s)", (input, expected) => {
    expect(amountInWords(input)).toBe(expected);
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-08T08:35:00Z");
  it.each([
    [new Date("2026-10-08T08:34:30Z"), "just now"],
    [new Date("2026-10-08T08:23:00Z"), "12 min ago"],
    [new Date("2026-10-08T06:30:00Z"), "2 h ago"],
    [new Date("2026-10-06T08:35:00Z"), "06 Oct 2026"],
  ])("%s", (d, expected) => {
    expect(formatRelative(d, now)).toBe(expected);
  });
});
