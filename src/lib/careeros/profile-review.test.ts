import { describe, expect, it } from "vitest";
import { createCareerOsData, withMasterProfileFoundation } from "./profile-data";
import { approvedProfileItems } from "./profile-extraction";
import { resolveClaimVariant, setProfileItemDecision } from "./profile-review";

describe("evidence review and approval workflow", () => {
  it("approves a profile item and records provenance-rich decision history", () => {
    const data = createCareerOsData();
    const target = data.profileItems.find((item) => item.id === "pi-google-pm-certificate");
    expect(target?.status).toBe("Conflict");

    const reviewed = setProfileItemDecision(data, {
      profileItemId: "pi-google-pm-certificate",
      status: "Approved",
      note: "User supplied the full certificate evidence.",
      at: "2026-08-18T12:45:00.000Z",
    });

    const approved = reviewed.profileItems?.find((item) => item.id === "pi-google-pm-certificate");
    expect(approved?.status).toBe("Approved");
    expect(approvedProfileItems(reviewed).map((item) => item.id)).toContain(
      "pi-google-pm-certificate",
    );

    const decision = reviewed.profileDecisions?.[0];
    expect(decision).toMatchObject({
      action: "Approve",
      targetType: "Profile Item",
      profileItemId: "pi-google-pm-certificate",
      previousStatus: "Conflict",
      newStatus: "Approved",
      sourceIds: target?.sourceIds,
      note: "User supplied the full certificate evidence.",
    });
    expect(reviewed.profileVersions[0]?.note).toContain("Approved");
    expect(reviewed.activity[0]?.text).toContain("Approved");
  });

  it("resolves one conflicting variant into an approved profile item and blocks alternatives", () => {
    const data = createCareerOsData();
    const selected = data.profileClaimVariants?.find((variant) => variant.id === "nas-donor-23");
    expect(selected?.status).toBe("Conflict");

    const reviewed = resolveClaimVariant(data, {
      canonicalKey: "nas-donor-base",
      selectedVariantId: "nas-donor-23",
      safeWording: "Increased the donor base by 23%.",
      note: "Selected after reviewing the supporting source.",
      at: "2026-08-18T12:46:00.000Z",
    });

    const variants = reviewed.profileClaimVariants?.filter(
      (variant) => variant.canonicalKey === "nas-donor-base",
    );
    expect(variants?.find((variant) => variant.id === "nas-donor-23")?.status).toBe("Approved");
    expect(variants?.find((variant) => variant.id === "nas-donor-42")?.status).not.toBe("Approved");

    const resolvedItem = reviewed.profileItems?.find(
      (item) => item.id === "resolved-nas-donor-base",
    );
    expect(resolvedItem).toMatchObject({
      status: "Approved",
      value: selected?.value,
      safeWording: "Increased the donor base by 23%.",
      sourceIds: selected?.sourceIds,
    });
    expect(approvedProfileItems(reviewed).map((item) => item.id)).toContain(
      "resolved-nas-donor-base",
    );

    expect(reviewed.profileDecisions?.[0]).toMatchObject({
      action: "Resolve Conflict",
      targetType: "Claim Variant",
      canonicalKey: "nas-donor-base",
      selectedVariantId: "nas-donor-23",
      newStatus: "Approved",
      sourceIds: selected?.sourceIds,
    });
  });

  it("preserves stored decisions when the master-profile foundation is re-applied", () => {
    const data = createCareerOsData();
    const reviewed = setProfileItemDecision(data, {
      profileItemId: "pi-google-pm-certificate",
      status: "Excluded",
      at: "2026-08-18T12:47:00.000Z",
    });

    const hydrated = withMasterProfileFoundation(reviewed);

    expect(hydrated.profileDecisions).toEqual(reviewed.profileDecisions);
    expect(
      hydrated.profileItems.find((item) => item.id === "pi-google-pm-certificate")?.status,
    ).toBe("Excluded");
  });
});
