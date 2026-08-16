import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  listKnowledgeItems: vi.fn(),
  createKnowledgeItem: vi.fn(),
  updateKnowledgeItem: vi.fn(),
  archiveKnowledgeItem: vi.fn(),
  deleteKnowledgeItem: vi.fn(),
  listEmploymentRoles: vi.fn(),
}));

vi.mock("@/lib/careeros/repositories/knowledge-repository", () => ({
  listKnowledgeItems: repositoryMocks.listKnowledgeItems,
  createKnowledgeItem: repositoryMocks.createKnowledgeItem,
  updateKnowledgeItem: repositoryMocks.updateKnowledgeItem,
  archiveKnowledgeItem: repositoryMocks.archiveKnowledgeItem,
  deleteKnowledgeItem: repositoryMocks.deleteKnowledgeItem,
}));

vi.mock("@/lib/careeros/repositories/employment-repository", () => ({
  listEmploymentRoles: repositoryMocks.listEmploymentRoles,
}));

vi.mock("@/components/careeros/app-shell", () => ({
  AppShell: ({ title, subtitle, actions, children }: any) => (
    <main>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{actions}</div>
      {children}
    </main>
  ),
}));

import { KnowledgeBankPage } from "./knowledge-bank-page";

const knowledgeRows = [
  {
    id: "knowledge-1",
    user_id: "user-a",
    employment_role_id: "role-1",
    category: "achievement",
    title: "Increased qualified leads",
    content: "Improved campaign targeting and creative testing.",
    star_context: "Lead quality needed improvement.",
    star_action: "Rebuilt targeting and testing.",
    star_result: "Qualified leads increased.",
    metrics: { increase: 18 },
    status: "user_confirmed",
    source_type: "user_input",
    source_reference: null,
    created_at: "2026-08-16T00:00:00.000Z",
    updated_at: "2026-08-16T00:00:00.000Z",
  },
  {
    id: "knowledge-2",
    user_id: "user-a",
    employment_role_id: null,
    category: "certification",
    title: "Platform certification",
    content: "Completed professional platform certification.",
    star_context: null,
    star_action: null,
    star_result: null,
    metrics: {},
    status: "imported_linkedin",
    source_type: "linkedin",
    source_reference: "LinkedIn profile",
    created_at: "2026-08-16T00:00:00.000Z",
    updated_at: "2026-08-16T00:00:00.000Z",
  },
];

const roles = [
  {
    id: "role-1",
    user_id: "user-a",
    employer: "Example Ltd",
    title: "Marketing Manager",
    employment_type: "Permanent",
    start_date: "2024-01-01",
    end_date: null,
    is_current: true,
    summary: null,
    created_at: "2026-08-16T00:00:00.000Z",
    updated_at: "2026-08-16T00:00:00.000Z",
  },
];

describe("Career Knowledge Bank page", () => {
  beforeEach(() => {
    repositoryMocks.listKnowledgeItems.mockReset().mockResolvedValue(knowledgeRows);
    repositoryMocks.listEmploymentRoles.mockReset().mockResolvedValue(roles);
    repositoryMocks.createKnowledgeItem.mockReset();
    repositoryMocks.updateKnowledgeItem.mockReset();
    repositoryMocks.archiveKnowledgeItem.mockReset();
    repositoryMocks.deleteKnowledgeItem.mockReset();
  });

  it("loads the user's Knowledge Bank and explains provenance", async () => {
    render(<KnowledgeBankPage />);

    expect(screen.getByRole("heading", { name: "Knowledge Bank" })).toBeInTheDocument();
    expect(
      screen.getByText(/your reusable career facts, achievements and evidence/i),
    ).toBeInTheDocument();

    await screen.findByText("Increased qualified leads");
    expect(screen.getByText("User confirmed")).toBeInTheDocument();
    expect(screen.getByText("Imported from LinkedIn")).toBeInTheDocument();
    expect(repositoryMocks.listKnowledgeItems).toHaveBeenCalledTimes(1);
  });

  it("shows role, category, status and source filters plus CRUD actions", async () => {
    render(<KnowledgeBankPage />);
    await screen.findByText("Increased qualified leads");

    expect(screen.getByLabelText("Filter by role")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by category")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by source")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add information/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /edit/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /archive/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /remove/i }).length).toBeGreaterThan(0);
  });

  it("opens an editor that explains STAR/CAR rather than silently inventing outcomes", async () => {
    render(<KnowledgeBankPage />);
    await screen.findByText("Increased qualified leads");

    screen.getByRole("button", { name: /add information/i }).click();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /add knowledge/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/STAR or CAR/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Career information")).toBeInTheDocument();
  });
});
