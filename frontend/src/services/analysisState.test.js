import { describe, expect, it } from "vitest";
import {
  beginAnalysis,
  completeAnalysis,
  failAnalysis,
  initialAnalysisState,
} from "./analysisState";

describe("analysis state", () => {
  it("clears previous results as soon as a new request starts", () => {
    const stateWithResults = {
      ...initialAnalysisState,
      data: { routes: [{ id: "old-route" }] },
      selectedRouteId: "old-route",
    };

    const next = beginAnalysis(stateWithResults, 2);

    expect(next.data).toBeNull();
    expect(next.selectedRouteId).toBeNull();
    expect(next.loading).toBe(true);
  });

  it("keeps failed requests free of stale results", () => {
    const started = beginAnalysis(
      {
        ...initialAnalysisState,
        data: { routes: [{ id: "old-route" }] },
      },
      2,
    );

    const failed = failAnalysis(started, 2, "No drivable route was found.");

    expect(failed.data).toBeNull();
    expect(failed.selectedRouteId).toBeNull();
    expect(failed.error).toBe("No drivable route was found.");
  });

  it("ignores an older response after a newer request begins", () => {
    const started = beginAnalysis(initialAnalysisState, 2);
    const stale = completeAnalysis(started, 1, {
      routes: [{ id: "stale-route" }],
    });

    expect(stale.data).toBeNull();
    expect(stale.loading).toBe(true);
  });
});
