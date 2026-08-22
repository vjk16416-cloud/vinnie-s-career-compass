import { describe, expect, it, vi } from "vitest";

import { runScheduledJobDiscoveryCore } from "./job-discovery.scheduled";
import type { JobSearchPreferences } from "./job-discovery.types";

const NOW = new Date("2026-08-22T07:00:00.000Z");
const preferences: JobSearchPreferences = {
  userId: "user-1",
  exactTitles: ["Head of Operations"],
  adjacentTitles: [],
  seniority: [],
  industries: [],
  locations: ["London, UK"],
  salaryMin: null,
  salaryCurrency: "GBP",
  workplaceTypes: ["Remote", "Hybrid"],
  employmentTypes: ["Permanent", "Contract", "Fixed-term"],
  includeUk: true,
  includeGlobalUkHireable: true,
  includeRelocationSponsorship: true,
  emailAlertsEnabled: true,
  derivedFromProfileAt: NOW.toISOString(),
  manualOverrides: {},
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

describe("scheduled job discovery", () => {
  it("skips a user who already has a scheduled run for the day", async () => {
    const refresh = vi.fn();
    const sendEmail = vi.fn();
    const result = await runScheduledJobDiscoveryCore(NOW, {
      listPreferences: vi.fn().mockResolvedValue([preferences]),
      findExistingRun: vi.fn().mockResolvedValue({ id: "run-1", emailSentAt: NOW.toISOString() }),
      runForUser: refresh,
      sendEmail,
    });

    expect(result.skipped).toBe(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("runs discovery and marks a successful shortlist email once", async () => {
    const markEmailSent = vi.fn();
    const result = await runScheduledJobDiscoveryCore(NOW, {
      listPreferences: vi.fn().mockResolvedValue([preferences]),
      findExistingRun: vi.fn().mockResolvedValue(null),
      runForUser: vi.fn().mockResolvedValue({
        runId: "run-2",
        jobs: [],
        email: "vinnie@example.com",
        alreadyEmailed: false,
      }),
      sendEmail: vi.fn().mockResolvedValue({ status: "sent", sentAt: NOW.toISOString() }),
      markEmailSent,
    });

    expect(result.completed).toBe(1);
    expect(markEmailSent).toHaveBeenCalledWith("run-2", NOW.toISOString());
  });
});
