import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import {
  approvedProfileItems,
  extractionCoverage,
  PROFILE_CLAIM_VARIANTS,
  unresolvedVariantKeys,
} from "./profile-extraction";

describe("master-profile extraction and reconciliation", () => {
  it("keeps unresolved and excluded claims out of approved output", () => {
    const data = createCareerOsData();
    const approvedIds = approvedProfileItems(data).map((item) => item.id);

    expect(approvedIds).not.toContain("pi-team-management");
    expect(approvedIds).not.toContain("pi-google-pm-certificate");
    expect(approvedIds).toContain("pi-budget");
  });

  it("distinguishes reconciled raw sources from audit-only historical sources", () => {
    const data = createCareerOsData();
    const m01 = data.profileSources?.find((source) => source.auditId === "M01");
    const d20 = data.profileSources?.find((source) => source.auditId === "D20");
    const m06 = data.profileSources?.find((source) => source.auditId === "M06");

    expect(m01?.extractionStatus).toBe("Reconciled");
    expect(d20?.extractionStatus).toBe("Audit only");
    expect(m06?.extractionStatus).toBe("Excluded");
  });

  it("preserves the metric and qualification conflicts identified by the audit", () => {
    const keys = unresolvedVariantKeys(PROFILE_CLAIM_VARIANTS);

    expect(keys).toEqual(
      expect.arrayContaining([
        "idea-delivery-improvement",
        "buchanan-time-to-fill",
        "nas-donor-base",
        "infinite-ticket-uplift",
        "google-project-management-certificate",
        "formal-people-management",
      ]),
    );

    expect(
      PROFILE_CLAIM_VARIANTS.filter((variant) => variant.canonicalKey === "nas-donor-base").map(
        (variant) => variant.value,
      ),
    ).toEqual(expect.arrayContaining(["23% donor-base increase", "42% donor-base increase"]));
  });

  it("reports extraction coverage without counting audit-only files as raw extraction", () => {
    const data = createCareerOsData();
    const coverage = extractionCoverage(data.profileSources ?? []);

    expect(coverage.totalAuditSources).toBe(43);
    expect(coverage.reconciled).toBeGreaterThanOrEqual(1);
    expect(coverage.auditOnly).toBeGreaterThan(0);
    expect(coverage.excluded).toBe(1);
    expect(coverage.rawExtracted).toBeLessThan(coverage.totalAuditSources);
  });

  it("registers fully read post-audit CVs as raw extracted sources", () => {
    const data = createCareerOsData();
    const expectedIds = [
      "source-post-revised-master",
      "source-post-logitech-original",
      "source-post-logitech-word-fixed",
      "source-post-blackrock-product",
      "source-post-graduate-project-manager",
      "source-post-southeastern-apm-star",
      "source-post-southeastern-assistant",
      "source-post-southeastern-matched-layout",
      "source-post-southeastern-assistant-copy",
    ];

    const postAuditSources = expectedIds.map((id) => data.profileSources?.find((source) => source.id === id));
    expect(postAuditSources.every(Boolean)).toBe(true);
    expect(postAuditSources.every((source) => source?.extractionStatus === "Raw extracted")).toBe(true);
    expect(postAuditSources.every((source) => source?.trust === "Alternative")).toBe(true);
  });

  it("keeps post-audit derivative claims behind the approval boundary", () => {
    const expected = [
      ["nul-ai-chatbot-qa", "Needs Evidence"],
      ["unidrop-user-research", "Excluded"],
      ["unidrop-project-leadership", "Excluded"],
      ["idea-pmo-dashboard", "Needs Evidence"],
      ["buchanan-ats-automation", "Needs Evidence"],
      ["bioprinting-final-frameworks", "Approved"],
    ] as const;

    expected.forEach(([key, status]) => {
      expect(
        PROFILE_CLAIM_VARIANTS.some(
          (variant) => variant.canonicalKey === key && variant.status === status,
        ),
      ).toBe(true);
    });

    expect(
      PROFILE_CLAIM_VARIANTS.some(
        (variant) =>
          variant.canonicalKey === "google-project-management-certificate" &&
          variant.sourceIds.includes("source-post-logitech-word-fixed") &&
          variant.status !== "Approved",
      ),
    ).toBe(true);
  });
});
