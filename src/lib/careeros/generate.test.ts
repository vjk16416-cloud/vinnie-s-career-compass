import { describe, expect, it } from "vitest";
import type { EmploymentRole, KnowledgeItem } from "@/lib/careeros/knowledge/types";
import type { CareerOsData, JobRecord } from "./types";
import { buildTailoredCv } from "./generate";

const data: CareerOsData = {
  profile: {
    name: "Alex Taylor",
    location: "London, UK",
    headline: "Digital Marketing Manager",
    summary: "Evidence-led digital marketing professional.",
    employment: [
      {
        id: "legacy-role",
        title: "Digital Marketing Manager",
        company: "Example Ltd",
        employmentType: "Permanent",
        start: "Jan 2024",
        end: "Present",
        location: "London, UK",
        summary: "Owns digital marketing delivery.",
        highlights: ["Old unverified fallback highlight should not be used"],
        skills: ["Digital marketing"],
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    skills: ["Digital marketing"],
    tools: ["Google Ads"],
    domains: ["Marketing"],
  },
  profileVersions: [],
  evidence: [],
  jobs: [],
  applications: [],
  cvs: [],
  coverLetters: [],
  scans: [],
  activity: [],
  settings: {
    claudeReviewEnabled: false,
    googleDriveFolder: "",
    driveConnected: false,
    dataSource: "Local seeded data",
  },
};

const job: JobRecord = {
  id: "job-1",
  company: "Target Co",
  title: "Senior Digital Marketing Manager",
  location: "London",
  description: "Lead digital campaigns, optimisation, analytics and stakeholder delivery.",
  createdAt: "2026-08-16T00:00:00.000Z",
  sourceType: "paste",
};

const employmentRole: EmploymentRole = {
  id: "role-a",
  user_id: "user-a",
  employer: "Example Ltd",
  title: "Digital Marketing Manager",
  employment_type: "Permanent",
  start_date: "2024-01-01",
  end_date: null,
  is_current: true,
  summary: null,
  created_at: "2026-08-16T00:00:00.000Z",
  updated_at: "2026-08-16T00:00:00.000Z",
};

function knowledge(id: string, action: string, result: string | null): KnowledgeItem {
  return {
    id,
    user_id: "user-a",
    employment_role_id: "role-a",
    category: "achievement",
    title: `Evidence ${id}`,
    content: action,
    star_context: "A business need existed.",
    star_action: action,
    star_result: result,
    metrics: {},
    status: "user_confirmed",
    source_type: "user_input",
    source_reference: null,
    created_at: "2026-08-16T00:00:00.000Z",
    updated_at: "2026-08-16T00:00:00.000Z",
  };
}

describe("Knowledge Bank backed CV generation", () => {
  it("generates 3 to 5 audited bullets and preserves role identity", () => {
    const result = buildTailoredCv(data, job, undefined, {
      knowledgeItems: [
        knowledge("k1", "Led multi-channel campaign delivery.", "Improved qualified lead quality."),
        knowledge("k2", "Built performance reporting dashboards.", "Made optimisation decisions faster."),
        knowledge("k3", "Coordinated campaign stakeholders.", "Kept delivery aligned to deadlines."),
      ],
      employmentRoles: [employmentRole],
    });

    expect(result.ready).toBe(true);
    expect(result.roleGaps).toEqual([]);
    expect(result.roleEvidenceMap["legacy-role"]).toEqual(["k1", "k2", "k3"]);
    expect(result.evidenceIds).toEqual(expect.arrayContaining(["k1", "k2", "k3"]));
    expect(result.body).toContain("### Digital Marketing Manager — Example Ltd (Permanent)");
    expect(result.body).toContain("Jan 2024 – Present | London, UK");
    expect(result.body.match(/^\- /gm)).toHaveLength(3);
    expect(result.body).not.toContain("Old unverified fallback highlight should not be used");
  });

  it("returns a structured role gap instead of padding a role with unsupported bullets", () => {
    const result = buildTailoredCv(data, job, undefined, {
      knowledgeItems: [
        knowledge("k1", "Led campaign delivery.", "Delivered the agreed campaign plan."),
        knowledge("k2", "Built performance reporting.", null),
      ],
      employmentRoles: [employmentRole],
    });

    expect(result.ready).toBe(false);
    expect(result.roleGaps).toEqual([
      expect.objectContaining({
        profileRoleId: "legacy-role",
        knowledgeRoleId: "role-a",
        missing: 1,
        options: ["strengthen", "use_as_is", "exclude"],
      }),
    ]);
    expect(result.body).not.toContain("Old unverified fallback highlight should not be used");
  });

  it("does not introduce metrics that are not present in a supported action or result", () => {
    const result = buildTailoredCv(data, job, undefined, {
      knowledgeItems: [
        {
          ...knowledge("k1", "Reworked campaign targeting.", null),
          metrics: { claimedIncrease: 99 },
        },
        knowledge("k2", "Built campaign reporting.", "Improved visibility for decision makers."),
        knowledge("k3", "Managed campaign stakeholders.", "Maintained delivery cadence."),
      ],
      employmentRoles: [employmentRole],
    });

    expect(result.body).toContain("Reworked campaign targeting.");
    expect(result.body).not.toContain("99");
    expect(result.body).not.toContain("99%");
  });
});
