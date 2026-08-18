import { describe, expect, it } from "vitest";
import { buildCoverLetter, buildTailoredCv } from "./generate";
import { createCareerOsData } from "./profile-data";
import { resolveClaimVariant } from "./profile-review";
import type { JobRecord } from "./types";

const job: JobRecord = {
  id: "job-profile-gate",
  company: "Example Technology",
  title: "Technology Project Manager",
  location: "London, UK",
  description:
    "Technology project delivery role requiring stakeholder management, analytics, Agile delivery and project fundamentals.",
  createdAt: "2026-08-18T11:10:00.000Z",
  sourceType: "paste",
};

describe("master-profile generation gate", () => {
  it("does not leak unresolved certifications into a tailored CV", () => {
    const data = createCareerOsData();
    const result = buildTailoredCv(data, job, undefined);

    expect(result.body).toContain("APM Project Fundamentals Qualification (PFQ)");
    expect(result.body).not.toContain("Google Project Management Professional Certificate");
    expect(result.body).not.toContain("Managed a team");
  });

  it("does not leak unresolved claims into a cover letter", () => {
    const data = createCareerOsData();
    data.profile.summary =
      "Managed a team and completed the Google Project Management Professional Certificate.";

    const result = buildCoverLetter(data, job, undefined);

    expect(result.body).not.toContain("Google Project Management Professional Certificate");
    expect(result.body).not.toContain("Managed a team");
  });

  it("makes explicitly resolved qualification wording eligible for the next tailored CV", () => {
    const data = createCareerOsData();
    const before = buildTailoredCv(data, job, undefined);
    expect(before.body).not.toContain("Google Project Management Professional Certificate");

    const reviewed = resolveClaimVariant(data, {
      canonicalKey: "google-project-management-certificate",
      selectedVariantId: "google-pm-full",
      safeWording: "Google Project Management Professional Certificate",
      at: "2026-08-18T12:55:00.000Z",
    });
    const after = buildTailoredCv(reviewed, job, undefined);

    expect(after.body).toContain("Google Project Management Professional Certificate");
    expect(after.body).not.toContain("Foundations of Project Management course completion claim");
  });
});
