import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeItem } from "@/lib/careeros/knowledge/types";
import type { TailoredCvClaim } from "@/lib/careeros/resume/tailored-cv";
import { TailoredCvReview } from "./tailored-cv-review";

const claim: TailoredCvClaim = {
  id: "experience:role-a:evidence-a",
  section: "experience",
  profileRoleId: "role-a",
  original: "Coordinated project activity.",
  proposed: "Owned cross-functional CRM migration delivery with stakeholders.",
  evidenceIds: ["evidence-a"],
};

const evidence = {
  id: "evidence-a",
  user_id: "user-a",
  employment_role_id: "role-a",
  category: "project",
  title: "Salesforce to Zoho CRM migration",
  content: "Owned and coordinated a CRM migration project.",
  star_context: null,
  star_action: null,
  star_result: null,
  metrics: {},
  status: "user_confirmed",
  source_type: "evidence_bank",
  source_reference: null,
  created_at: "2026-08-21T00:00:00.000Z",
  updated_at: "2026-08-21T00:00:00.000Z",
} as KnowledgeItem;

describe("tailored CV review", () => {
  it("shows original, proposed and human-readable supporting evidence before approval", () => {
    render(
      <TailoredCvReview
        claims={[claim]}
        knowledgeItems={[evidence]}
        status="Draft"
        onApprove={vi.fn()}
      />,
    );

    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("Coordinated project activity.")).toBeInTheDocument();
    expect(screen.getByText("Owned cross-functional CRM migration delivery with stakeholders.")).toBeInTheDocument();
    expect(screen.getByText("Salesforce to Zoho CRM migration")).toBeInTheDocument();
    expect(screen.getByText(/user confirmed/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Approved$/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve tailored cv/i })).toBeInTheDocument();
  });
});
