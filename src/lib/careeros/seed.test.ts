import { describe, expect, it } from "vitest";

import { createSeedData } from "./seed";

describe("audited Career OS seed", () => {
  it("uses Vinnie's confirmed employment chronology", () => {
    const data = createSeedData();
    const northeastern = data.profile.employment.find((role) => role.id === "emp-nul");
    const nas = data.profile.employment.find((role) => role.id === "emp-nas");
    const infinite = data.profile.employment.find((role) => role.id === "emp-infinite");

    expect(northeastern?.end).toBe("Dec 2025");
    expect(nas?.employmentType).toBe("Unspecified");
    expect(infinite?.employmentType).toBe("Unspecified");
  });

  it("treats the supplied audit, master CV and user confirmation as sufficient evidence", () => {
    const data = createSeedData();
    const budget = data.evidence.find((record) => record.id === "ev-budget");

    expect(budget).toMatchObject({
      status: "Verified",
      confidence: "High",
      metricValue: "£140k+ annual budget",
    });
    expect(data.evidence.filter((record) => record.status === "Needs Evidence")).toEqual([]);
  });

  it("records the frameworks supported by the final 3D Bioprinting report", () => {
    const data = createSeedData();
    const project = data.profile.projects.find((record) => record.id === "proj-bioprinting");
    const evidence = data.evidence.find((record) => record.id === "ev-trl");

    expect(project?.summary).toContain("TRL, AD² and S-curve");
    expect(project?.summary).not.toContain("Gartner");
    expect(evidence?.claim).toContain("TRL, AD² and S-curve");
    expect(evidence?.claim).not.toContain("Gartner");
  });

  it("separates founder prototypes from commercial employment", () => {
    const data = createSeedData();
    const intentionally = data.profile.projects.find(
      (record) => record.id === "proj-intentionally",
    );
    const atlas = data.profile.projects.find((record) => record.id === "proj-atlas");

    expect(intentionally?.summary).toContain("mobile-first dating MVP");
    expect(atlas?.summary).toContain("static prototype");
    expect(atlas?.summary).toContain("not a production system");
    expect(data.profile.employment.some((role) => role.company === "Intentionally")).toBe(false);
    expect(data.profile.employment.some((role) => role.company === "Atlas")).toBe(false);
  });
});
