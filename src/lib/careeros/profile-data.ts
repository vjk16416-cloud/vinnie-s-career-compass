import { PROFILE_CLAIM_VARIANTS } from "./profile-extraction";
import { PROFILE_ITEMS, PROFILE_SOURCES } from "./profile-foundation";
import { createSeedData } from "./seed";
import type {
  CareerClaimVariant,
  CareerOsData,
  CareerProfileItem,
  CareerProfileSource,
  ProfileSourceExtractionStatus,
} from "./types";

const REGISTER_SOURCES: CareerProfileSource[] = [
  {
    id: "source-master-profile-register",
    label: "Master Career Profile",
    sourceType: "Evidence Register",
    modifiedAt: "2026-08-10",
    ownership: "Confirmed mine",
    ingestionStatus: "Imported",
    extractionStatus: "Reconciled",
    trust: "Evidence",
    externalFileId: "154AAI-KiLDpoZPDRmzX6UUn9n6niXHyeg1r09lWqs7c",
    externalUrl: "https://docs.google.com/document/d/154AAI-KiLDpoZPDRmzX6UUn9n6niXHyeg1r09lWqs7c/edit",
    notes: "CareerOS high-level register. Later direct user confirmation overrides older chronology where they differ.",
  },
  {
    id: "source-evidence-bank",
    label: "Evidence Bank",
    sourceType: "Evidence Register",
    modifiedAt: "2026-08-10",
    ownership: "Confirmed mine",
    ingestionStatus: "Imported",
    extractionStatus: "Reconciled",
    trust: "Evidence",
    externalFileId: "1RQC10S4I3LulysK6mkyTQmtc8EZ4BK8ENjVyKByelo4",
    externalUrl: "https://docs.google.com/document/d/1RQC10S4I3LulysK6mkyTQmtc8EZ4BK8ENjVyKByelo4/edit",
    notes: "Canonical CareerOS evidence map and evidence-boundary rules.",
  },
  {
    id: "source-metrics-register",
    label: "Metrics Register",
    sourceType: "Evidence Register",
    modifiedAt: "2026-08-09",
    ownership: "Confirmed mine",
    ingestionStatus: "Imported",
    extractionStatus: "Reconciled",
    trust: "Evidence",
    externalFileId: "1-nTmLGW90RB6SU-Vwn16-pXz7-I8Gc9ACNrmXpIV9Vc",
    externalUrl: "https://docs.google.com/document/d/1-nTmLGW90RB6SU-Vwn16-pXz7-I8Gc9ACNrmXpIV9Vc/edit",
    notes: "Separates usable-with-caution metrics from softened, conflicting and removed metrics.",
  },
  {
    id: "source-education-register",
    label: "Education & Certifications Register",
    sourceType: "Evidence Register",
    modifiedAt: "2026-08-10",
    ownership: "Confirmed mine",
    ingestionStatus: "Imported",
    extractionStatus: "Reconciled",
    trust: "Evidence",
    externalFileId: "1Is4d-4q-lESLIMF1_C0avEBdmuVeOuhIofDU8SEM0Lw",
    externalUrl: "https://docs.google.com/document/d/1Is4d-4q-lESLIMF1_C0avEBdmuVeOuhIofDU8SEM0Lw/edit",
    notes: "CareerOS source of truth for education, qualification and training status.",
  },
  {
    id: "source-apm-pfq-primary",
    label: "APM PFQ - Verified Evidence - 13 Jan 2025",
    sourceType: "Primary Evidence",
    modifiedAt: "2026-08-10",
    ownership: "Confirmed mine",
    ingestionStatus: "Imported",
    extractionStatus: "Reconciled",
    trust: "Evidence",
    externalFileId: "1PeV3LUMkjaXx6l9b1buJt5KMrS7ChR05YwZXbrzLLsQ",
    externalUrl: "https://docs.google.com/document/d/1PeV3LUMkjaXx6l9b1buJt5KMrS7ChR05YwZXbrzLLsQ/edit",
    notes: "Primary CareerOS evidence derived from the user-provided Credly badge; verifies qualification, issuer and 13 January 2025 issue date.",
  },
];

function extractionStatusFor(source: CareerProfileSource): ProfileSourceExtractionStatus {
  if (source.extractionStatus) return source.extractionStatus;
  if (!source.auditId) return "Reconciled";
  if (source.auditId === "M01") return "Reconciled";
  if (source.auditId === "M06") return "Excluded";
  return "Audit only";
}

function seededProfileSources(): CareerProfileSource[] {
  return [
    ...PROFILE_SOURCES.map((source) => ({
      ...source,
      extractionStatus: extractionStatusFor(source),
    })),
    ...REGISTER_SOURCES,
  ];
}

export type CareerOsDataWithMasterProfile = CareerOsData & {
  profileSources: CareerProfileSource[];
  profileItems: CareerProfileItem[];
  profileClaimVariants: CareerClaimVariant[];
};

export function withMasterProfileFoundation(data: CareerOsData): CareerOsDataWithMasterProfile {
  return {
    ...data,
    profileSources: data.profileSources ?? seededProfileSources(),
    profileItems: data.profileItems ?? PROFILE_ITEMS,
    profileClaimVariants: data.profileClaimVariants ?? PROFILE_CLAIM_VARIANTS,
  };
}

export function createCareerOsData(): CareerOsDataWithMasterProfile {
  return withMasterProfileFoundation(createSeedData());
}
