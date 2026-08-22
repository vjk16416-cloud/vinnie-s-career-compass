import { describe, expect, it } from "vitest";
import type { CareerOsData, JobRecord } from "./types";
import { buildTailoredCvProposal } from "./cv-tailoring-proposal";

const data = {
  profile: {
    name: "Vinnie",
    location: "London",
    headline: "Product | Project Delivery",
    summary: "Technology and delivery professional.",
    employment: [
      {
        id: "role-1",
        title: "Marketing & Operations Executive",
        company: "IDEA StatiCa UK",
        employmentType: "Permanent",
        start: "Sep 2023",
        end: "Jun 2024",
        location: "London",
        summary: "",
        highlights: ["Original project delivery wording."],
        skills: ["Project delivery"],
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    skills: ["Project delivery", "Stakeholder management"],
    tools: [],
    domains: [],
  },
  evidence: [
    {
      id: "ev-product",
      employer: "IDEA StatiCa UK",
      category: "Delivery",
      claim: "Coordinated cross-functional project delivery using Asana workflows",
      source: "Verified CV evidence",
      confidence: "High",
      status: "Verified",
      skills: ["Project delivery", "Stakeholder management"],
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
    {
      id: "ev-blocked",
      employer: "IDEA StatiCa UK",
      category: "Delivery",
      claim: "Unverified product ownership claim",
      source: "Old draft",
      confidence: "Low",
      status: "Needs Evidence",
      skills: ["Product management"],
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
  ],
  profileItems: [
    {
      id: "pi-professional-summary",
      kind: "Identity",
      label: "Professional summary",
      value: "Evidence-led technology and project-delivery professional.",
      safeWording: "Evidence-led technology and project-delivery professional.",
      sourceIds: [],
      evidenceIds: [],
      status: "Approved",
      confidence: "High",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
    {
      id: "pi-employment-1",
      kind: "Employment",
      label: "IDEA StatiCa UK employment",
      value: "Marketing & Operations Executive — IDEA StatiCa UK — Sep 2023 to Jun 2024",
      safeWording: "Marketing & Operations Executive — IDEA StatiCa UK — Sep 2023 to Jun 2024",
      sourceIds: [],
      evidenceIds: ["ev-product"],
      status: "Approved",
      confidence: "High",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
  ],
  profileSources: [],
  claimVariants: [],
  profileDecisions: [],
  profileVersions: [],
  jobs: [],
  applications: [],
  cvs: [],
  coverLetters: [],
  scans: [],
  reviewRuns: [],
  activity: [],
  settings: {
    claudeReviewEnabled: false,
    googleDriveFolder: "",
    driveConnected: false,
    dataSource: "Local seeded data",
  },
} as unknown as CareerOsData;

const job = {
  id: "job-1",
  company: "Capital on Tap",
  title: "Associate Product Manager",
  location: "London",
  description:
    "Own product features and projects end to end. Work with stakeholders, customers and delivery teams on product roadmap and commercial outcomes.",
  createdAt: "2026-08-21T00:00:00.000Z",
  sourceType: "url",
} as JobRecord;

describe("CV tailoring proposal", () => {
  it("keeps factual proposals traceable to verified evidence only", () => {
    const proposal = buildTailoredCvProposal(data, job, undefined);

    expect(proposal.category).toBe("Product Management");
    expect(proposal.status).toBe("Draft");
    expect(proposal.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "experience",
          proposed: expect.stringMatching(/cross-functional project delivery/i),
          evidenceIds: ["ev-product"],
        }),
      ]),
    );
    expect(proposal.evidenceIds).toContain("ev-product");
    expect(proposal.evidenceIds).not.toContain("ev-blocked");
    expect(proposal.body).not.toMatch(/unverified product ownership/i);
  });
});
