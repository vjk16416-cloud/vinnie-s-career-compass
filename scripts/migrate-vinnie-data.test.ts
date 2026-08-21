import { describe, expect, it } from "vitest";
import { buildVinnieMigrationRows } from "./migrate-vinnie-data";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("Vinnie canonical Drive migration", () => {
  it("uses the canonical five-role chronology and does not mark Northeastern current", () => {
    const rows = buildVinnieMigrationRows(USER_ID);
    const northeastern = rows.employmentRoles.find(
      (role) => role.employer === "Northeastern University London",
    );

    expect(rows.employmentRoles).toHaveLength(5);
    expect(northeastern).toMatchObject({
      title: "Performance Marketing Manager",
      employment_type: "Contract",
      start_date: "2025-06-01",
      end_date: "2025-12-01",
      is_current: false,
    });
  });

  it("locks user-confirmed metrics as verified while keeping contradictory metrics excluded", () => {
    const rows = buildVinnieMigrationRows(USER_ID);
    const verifiedTitles = [
      "£140k+ annual digital media budget",
      "40%+ uplift in qualified leads",
      "CPL variation £3 to £646",
      "35% efficiency improvement",
      "28% ROI improvement / 20% conversion uplift",
      "30+ campaign landing pages",
      "27% conversion increase from landing-page/A-B activity",
      "15% conversion uplift / 36% ROI improvement",
      "32% response-rate improvement / 15% conversion uplift from prospecting",
      "62% engagement increase / 23% marketing-cost reduction",
      "30% collateral/case-study engagement uplift",
      "30% click increase / 60% impression increase",
      "440% ROAS on 100K Running Challenge",
      "800+ ticket sales per event",
    ];

    for (const title of verifiedTitles) {
      expect(rows.knowledgeItems.find((item) => item.title === title)?.status).toBe("verified");
    }

    const projectCompletion = rows.knowledgeItems.find((item) =>
      item.title.includes("25% project-completion"),
    );
    expect(projectCompletion?.status).toBe("excluded");
  });

  it("preserves verified and unresolved qualification status conservatively", () => {
    const rows = buildVinnieMigrationRows(USER_ID);
    const apm = rows.knowledgeItems.find((item) => item.title.includes("APM Project Fundamentals"));
    const googlePm = rows.knowledgeItems.find((item) =>
      item.title.includes("Google Project Management Professional Certificate"),
    );

    expect(apm?.status).toBe("verified");
    expect(googlePm?.status).toBe("needs_verification");
  });

  it("migrates the three canonical role-family master CVs but no seeded demo applications", () => {
    const rows = buildVinnieMigrationRows(USER_ID);

    expect(rows.resumeVersions).toHaveLength(3);
    expect(rows.resumeVersions.map((version) => version.content)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roleFamily: "Product / Product Management", sourceTitle: expect.stringContaining("BlackRock") }),
        expect.objectContaining({ roleFamily: "Product / Junior Product Manager", sourceTitle: expect.stringContaining("Teya") }),
        expect.objectContaining({ roleFamily: "Project / PMO / Delivery", sourceTitle: expect.stringContaining("Reply") }),
      ]),
    );
    expect(rows.applications).toEqual([]);
  });

  it("uses deterministic stable IDs so repeated runs are idempotent", () => {
    const first = buildVinnieMigrationRows(USER_ID);
    const second = buildVinnieMigrationRows(USER_ID);

    expect(second).toEqual(first);

    for (const collection of [
      first.employmentRoles,
      first.knowledgeItems,
      first.evidenceItems,
      first.resumeVersions,
    ]) {
      const ids = collection.map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("assigns every migrated user-owned row to the supplied authenticated user ID", () => {
    const rows = buildVinnieMigrationRows(USER_ID);

    expect(rows.profile.user_id).toBe(USER_ID);
    for (const collection of [
      rows.employmentRoles,
      rows.knowledgeItems,
      rows.evidenceItems,
      rows.resumeVersions,
    ]) {
      expect(collection.every((row) => row.user_id === USER_ID)).toBe(true);
    }
  });
});
