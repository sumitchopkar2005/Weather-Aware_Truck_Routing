import { describe, expect, it } from "vitest";
import { formatDuration, RISK_COLORS } from "./risk";

describe("risk display helpers", () => {
  it("formats route durations", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
  });

  it("provides a distinct color for each assessment category", () => {
    expect(Object.keys(RISK_COLORS)).toEqual([
      "Low",
      "Moderate",
      "High",
      "Severe",
      "No Travel",
      "Unknown",
    ]);
  });
});
