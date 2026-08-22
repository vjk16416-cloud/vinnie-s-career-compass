import { describe, expect, it, vi } from "vitest";

import { createJobDiscoveryRepository } from "./job-discovery.repository";
import type { JobSearchPreferences } from "./job-discovery.types";

function preferences(): JobSearchPreferences {
  return {
    userId: "user-1",
    exactTitles: ["Head of Operations"],
    adjacentTitles: ["Programme Director"],
    seniority: ["Director / Head"],
    industries: ["Technology"],
    locations: ["London, UK"],
    salaryMin: 90000,
    salaryCurrency: "GBP",
    workplaceTypes: ["Remote", "Hybrid"],
    employmentTypes: ["Permanent", "Contract", "Fixed-term"],
    includeUk: true,
    includeGlobalUkHireable: true,
    includeRelocationSponsorship: true,
    emailAlertsEnabled: true,
    derivedFromProfileAt: "2026-08-22T10:00:00.000Z",
    manualOverrides: { salaryMin: true },
    createdAt: "2026-08-22T10:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
  };
}

type Result = { data: unknown; error: unknown };

function fakeSupabase(result: Result = { data: [], error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const single = vi.fn().mockResolvedValue(result);
  const order = vi.fn().mockResolvedValue(result);
  const secondEq = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
  const eq = vi.fn(() => ({ maybeSingle, order, eq: secondEq }));
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, upsert, update }));

  return { from, select, eq, secondEq, maybeSingle, order, upsert, update, single };
}

describe("createJobDiscoveryRepository", () => {
  it("loads only the authenticated user's preferences", async () => {
    const row = {
      user_id: "user-1",
      exact_titles: ["Head of Operations"],
      adjacent_titles: ["Programme Director"],
      seniority: ["Director / Head"],
      industries: ["Technology"],
      locations: ["London, UK"],
      salary_min: 90000,
      salary_currency: "GBP",
      workplace_types: ["Remote", "Hybrid"],
      employment_types: ["Permanent", "Contract", "Fixed-term"],
      include_uk: true,
      include_global_uk_hireable: true,
      include_relocation_sponsorship: true,
      email_alerts_enabled: true,
      derived_from_profile_at: "2026-08-22T10:00:00.000Z",
      manual_overrides: { salaryMin: true },
      created_at: "2026-08-22T10:00:00.000Z",
      updated_at: "2026-08-22T10:00:00.000Z",
    };
    const client = fakeSupabase({ data: row, error: null });
    const repository = createJobDiscoveryRepository(client as never, "user-1");

    await expect(repository.loadPreferences()).resolves.toMatchObject({
      userId: "user-1",
      exactTitles: ["Head of Operations"],
      salaryMin: 90000,
      emailAlertsEnabled: true,
    });
    expect(client.from).toHaveBeenCalledWith("job_search_preferences");
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("persists preferences with the repository user id rather than trusting input ownership", async () => {
    const row = {
      user_id: "user-1",
      exact_titles: ["Head of Operations"],
      adjacent_titles: ["Programme Director"],
      seniority: ["Director / Head"],
      industries: ["Technology"],
      locations: ["London, UK"],
      salary_min: 90000,
      salary_currency: "GBP",
      workplace_types: ["Remote", "Hybrid"],
      employment_types: ["Permanent", "Contract", "Fixed-term"],
      include_uk: true,
      include_global_uk_hireable: true,
      include_relocation_sponsorship: true,
      email_alerts_enabled: true,
      derived_from_profile_at: "2026-08-22T10:00:00.000Z",
      manual_overrides: { salaryMin: true },
      created_at: "2026-08-22T10:00:00.000Z",
      updated_at: "2026-08-22T10:00:00.000Z",
    };
    const client = fakeSupabase({ data: row, error: null });
    const repository = createJobDiscoveryRepository(client as never, "user-1");

    await repository.savePreferences({ ...preferences(), userId: "other-user" });

    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        salary_min: 90000,
        email_alerts_enabled: true,
      }),
      { onConflict: "user_id" },
    );
  });

  it("lists discovered jobs only for the authenticated user", async () => {
    const client = fakeSupabase({ data: [], error: null });
    const repository = createJobDiscoveryRepository(client as never, "user-123");

    await expect(repository.listJobs()).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledWith("discovered_jobs");
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("updates only the saved flag for one owned job", async () => {
    const client = fakeSupabase({ data: { id: "job-1", saved: true }, error: null });
    const repository = createJobDiscoveryRepository(client as never, "user-1");

    await repository.setSaved("job-1", true);

    expect(client.update).toHaveBeenCalledWith({ saved: true });
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(client.secondEq).toHaveBeenCalledWith("id", "job-1");
  });

  it("lists discovery runs only for the authenticated user", async () => {
    const client = fakeSupabase({ data: [], error: null });
    const repository = createJobDiscoveryRepository(client as never, "user-9");

    await expect(repository.listRuns()).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledWith("job_discovery_runs");
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-9");
  });
});
