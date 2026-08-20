import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  listEmploymentRoles: vi.fn(),
  listKnowledgeItems: vi.fn(),
}));

vi.mock("@/lib/careeros/repositories/profile-repository", () => ({
  getProfile: repositoryMocks.getProfile,
}));

vi.mock("@/lib/careeros/repositories/employment-repository", () => ({
  listEmploymentRoles: repositoryMocks.listEmploymentRoles,
}));

vi.mock("@/lib/careeros/repositories/knowledge-repository", () => ({
  listKnowledgeItems: repositoryMocks.listKnowledgeItems,
}));

vi.mock("@/components/careeros/app-shell", () => ({
  AppShell: ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));

import { ProfilePage } from "./profile-page";

const profile = {
  user_id: "user-a",
  display_name: "Vinnie Jegathees",
  location: "London, UK",
  professional_summary: "Product, delivery and technology-focused career profile.",
  target_roles: ["Product Management", "Technology Consulting"],
  target_industries: ["Technology", "Professional Services"],
  writing_preferences: {},
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
};

const roles = [
  {
    id: "role-1",
    user_id: "user-a",
    employer: "Example Ltd",
    title: "Marketing & Operations Executive",
    employment_type: "Contract",
    start_date: "2023-09-01",
    end_date: "2024-06-30",
    is_current: false,
    summary: "Enterprise software adoption and cross-functional delivery.",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  },
];

const knowledgeRows = [
  {
    id: "knowledge-1",
    user_id: "user-a",
    employment_role_id: "role-1",
    category: "achievement",
    title: "Built a unified reporting layer",
    content: "Integrated HubSpot and Salesforce data into Power BI reporting.",
    star_context: "Reporting was fragmented across systems.",
    star_action: "Built a Power BI reporting layer.",
    star_result: "Created a unified reporting view.",
    metrics: {},
    status: "verified",
    source_type: "project",
    source_reference: "Reporting project record",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  },
  {
    id: "knowledge-2",
    user_id: "user-a",
    employment_role_id: "role-1",
    category: "metric",
    title: "Improved conversion by 15%",
    content: "A CV states a 15% conversion improvement.",
    star_context: null,
    star_action: null,
    star_result: null,
    metrics: { conversion_improvement: "15%" },
    status: "needs_verification",
    source_type: "cv",
    source_reference: "Master CV",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  },
  {
    id: "knowledge-3",
    user_id: "user-a",
    employment_role_id: "role-1",
    category: "claim",
    title: "Unsupported direct reports claim",
    content: "Do not use this claim.",
    star_context: null,
    star_action: null,
    star_result: null,
    metrics: {},
    status: "excluded",
    source_type: "other",
    source_reference: null,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  },
];

describe("Career Profile page", () => {
  beforeEach(() => {
    repositoryMocks.getProfile.mockReset().mockResolvedValue(profile);
    repositoryMocks.listEmploymentRoles.mockReset().mockResolvedValue(roles);
    repositoryMocks.listKnowledgeItems.mockReset().mockResolvedValue(knowledgeRows);
  });

  it("loads the canonical Supabase profile, employment roles and reusable career knowledge", async () => {
    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Career Profile" })).toBeInTheDocument();
    await screen.findByText("Vinnie Jegathees · London, UK");
    expect(screen.getByText(profile.professional_summary)).toBeInTheDocument();
    expect(screen.getByText("Marketing & Operations Executive — Example Ltd")).toBeInTheDocument();
    expect(screen.getByText("Built a unified reporting layer")).toBeInTheDocument();
    expect(repositoryMocks.getProfile).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listEmploymentRoles).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listKnowledgeItems).toHaveBeenCalledTimes(1);
  });

  it("shows verification provenance and does not surface excluded knowledge as reusable evidence", async () => {
    render(<ProfilePage />);

    await screen.findByText("Built a unified reporting layer");
    expect(screen.getByText("Verified evidence")).toBeInTheDocument();
    expect(screen.getByText("Needs verification")).toBeInTheDocument();
    expect(screen.getByText(/CV · Master CV/)).toBeInTheDocument();
    expect(screen.queryByText("Unsupported direct reports claim")).not.toBeInTheDocument();
  });
});
