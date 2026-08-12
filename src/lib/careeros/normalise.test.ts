import { describe, expect, test } from "bun:test";
import { createSeedData } from "./seed";
import { normaliseData } from "./normalise";

describe("normaliseData August 2026 sync", () => {
  test("corrects known stale baseline values without overwriting unrelated saved values", () => {
    const old = createSeedData();
    old.profileVersions = old.profileVersions.filter(
      (v) => v.id !== "pv-2026-08-12-career-sync",
    );
    old.profile.name = "Vinnie Custom";
    old.profile.headline =
      "Performance Marketing Manager | UCL MSc Technology Management candidate";
    old.profile.summary =
      "Performance Marketing Manager and part-time UCL MSc Technology Management candidate, combining multi-market digital acquisition experience with technology evaluation, new product development, analytics, stakeholder management, project delivery, and product/innovation work.";
    const nul = old.profile.employment.find((e) => e.id === "emp-nul")!;
    nul.end = "Present";

    const result = normaliseData(old);

    expect(result.profile.name).toBe("Vinnie Custom");
    expect(result.profile.headline).toContain("Project & Technology Delivery");
    expect(result.profile.employment.find((e) => e.id === "emp-nul")?.end).toBe("Dec 2025");
  });

  test("adds cvRules and Southeastern records once", () => {
    const old: any = {
      profile: createSeedData().profile,
      profileVersions: [{ id: "pv-1", createdAt: "x", label: "old", note: "old" }],
      evidence: createSeedData().evidence,
      jobs: [],
      applications: [],
      cvs: [],
      coverLetters: [],
      scans: [],
      activity: [],
      settings: {
        claudeReviewEnabled: true,
        googleDriveFolder: "",
        driveConnected: false,
        dataSource: "Local seeded data",
      },
    };

    const once = normaliseData(old);
    const twice = normaliseData(once);

    expect(once.settings.cvRules.noEmDashes).toBe(true);
    expect(once.settings.claudeReviewEnabled).toBe(true);
    expect(
      once.jobs.filter((j) => j.id === "job-southeastern-apm-3577"),
    ).toHaveLength(1);
    expect(
      twice.jobs.filter((j) => j.id === "job-southeastern-apm-3577"),
    ).toHaveLength(1);
    expect(
      twice.applications.filter(
        (a) => a.company === "Southeastern" && a.title === "Assistant Project Manager",
      ),
    ).toHaveLength(1);
    expect(
      twice.cvs.filter((c) => c.id === "cv-southeastern-apm-3577"),
    ).toHaveLength(1);
  });

  test("preserves an existing Southeastern application stage", () => {
    const old = createSeedData();
    old.profileVersions = old.profileVersions.filter(
      (v) => v.id !== "pv-2026-08-12-career-sync",
    );
    const app = old.applications.find(
      (a) => a.id === "app-southeastern-apm-3577",
    )!;
    app.stage = "Applied";

    const result = normaliseData(old);

    expect(
      result.applications.find((a) => a.id === "app-southeastern-apm-3577")?.stage,
    ).toBe("Applied");
  });

  test("does not promote conservative evidence statuses", () => {
    const result = normaliseData(createSeedData());
    expect(result.evidence.find((e) => e.id === "ev-cvr")?.status).toBe(
      "Needs Evidence",
    );
    expect(result.evidence.find((e) => e.id === "ev-nas")?.status).toBe(
      "Needs Evidence",
    );
    expect(result.evidence.find((e) => e.id === "ev-pmo")?.status).toBe(
      "Excluded",
    );
  });
});
