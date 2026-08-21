import { describe, expect, it } from "vitest";
import { normaliseData } from "./normalise";
import { createCareerOsData } from "./profile-data";
import type { CareerOsData } from "./types";

describe("Sprint 6 reviewer state compatibility", () => {
  it("normalises pre-Sprint-6 state with an empty review history without losing existing data", () => {
    const old = createCareerOsData();
    const oldShape = structuredClone(old) as CareerOsData;

    const result = normaliseData(oldShape) as CareerOsData & { reviewRuns?: unknown[] };

    expect(result.reviewRuns).toEqual([]);
    expect(result.jobs).toEqual(old.jobs);
    expect(result.cvs[0]?.versions).toEqual(old.cvs[0]?.versions);
    expect(result.coverLetters).toEqual(old.coverLetters);
  });
});
