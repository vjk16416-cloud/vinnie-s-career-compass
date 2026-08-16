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
      end_date: "2025-11-01",
      is_current: false,
    });
  });

  it("keeps disputed metrics out of usable evidence states", () => {
    const rows = buildVinnieMigrationRows(USER_ID);
    const budget = rows.knowledgeItems.find((item) => item.title.includes("£140k+"));
    const projectCompletion = rows.knowledgeItems.find((item) =>
      item.title.includes("25% project-completion"),
    );

    expect(budget?.status).toBe("needs_verification");
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
