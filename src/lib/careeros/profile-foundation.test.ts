import { describe, expect, it } from "vitest";

import { createCareerOsData } from "./profile-data";

const auditedResumeIds = [
  "M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10", "M11",
  "H01", "H02", "H03", "H04", "H05", "H06", "H07", "H08", "H09", "H10",
  "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D11",
  "D12", "D13", "D14", "D15", "D16", "D17", "D18", "D19", "D20", "D21", "D22",
];

describe("master career profile foundation", () => {
  it("indexes every career document listed in the July evidence audit", () => {
    const data = createCareerOsData();
    const indexedAuditIds = data.profileSources
      .map((source) => source.auditId)
      .filter((id): id is string => Boolean(id));

    expect(indexedAuditIds).toEqual(expect.arrayContaining(auditedResumeIds));
    expect(new Set(indexedAuditIds).size).toBe(auditedResumeIds.length);
  });

  it("keeps unsafe and outdated sources without treating them as approved facts", () => {
    const data = createCareerOsData();
    const unsafeDraft = data.profileSources.find((source) => source.auditId === "M06");
    const historical = data.profileSources.find((source) => source.auditId === "H01");

    expect(unsafeDraft).toMatchObject({ ingestionStatus: "Excluded", trust: "Unsafe" });
    expect(historical).toMatchObject({ ingestionStatus: "Indexed", trust: "Historical" });
  });

  it("records provenance and approval state for master profile items", () => {
    const data = createCareerOsData();
    const chronology = data.profileItems.find((item) => item.id === "pi-nul-chronology");
    const project = data.profileItems.find((item) => item.id === "pi-intentionally");

    expect(chronology).toMatchObject({ status: "Approved", confidence: "High" });
    expect(chronology?.sourceIds.length).toBeGreaterThan(0);
    expect(project?.sourceIds).toContain("source-audit-2026-07-23");
  });

  it("surfaces unresolved certification wording instead of silently promoting it", () => {
    const data = createCareerOsData();
    const googlePm = data.profileItems.find((item) => item.id === "pi-google-pm-certificate");

    expect(googlePm).toMatchObject({ status: "Conflict", confidence: "Low" });
    expect(googlePm?.notes).toContain("full certificate");
  });
});
