import type { DiscoveryFetch } from "./job-discovery.providers";
import type { DiscoveredJob, JobSearchPreferences } from "./job-discovery.types";
import { selectDailyShortlist } from "./job-discovery.orchestrator";
import type { JobDiscoveryServerEnv } from "./job-discovery.server";

export type JobDiscoveryEmailResult =
  | { status: "sent"; sentAt: string }
  | { status: "disabled" | "unavailable" | "duplicate" | "empty" | "error"; message: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jobLine(job: DiscoveredJob) {
  const url = job.preferredApplyUrl ?? job.preferredSourceUrl;
  const fit = job.fitScore != null ? ` · ${job.fitScore}% CareerOS fit` : "";
  const location = job.location ? ` · ${escapeHtml(job.location)}` : "";
  const title = escapeHtml(job.title);
  const company = escapeHtml(job.company);
  const label = `${title} at ${company}${location}${fit}`;
  return url
    ? `<li style="margin:0 0 10px"><a href="${escapeHtml(url)}">${label}</a></li>`
    : `<li style="margin:0 0 10px">${label}</li>`;
}

export async function sendDailyJobShortlist(
  input: {
    preferences: JobSearchPreferences;
    jobs: DiscoveredJob[];
    to: string;
    now?: Date;
    runAlreadyEmailed: boolean;
  },
  env: Pick<
    JobDiscoveryServerEnv,
    "RESEND_API_KEY" | "JOB_DISCOVERY_FROM_EMAIL" | "PUBLIC_APP_URL"
  >,
  fetchImpl: DiscoveryFetch = fetch,
): Promise<JobDiscoveryEmailResult> {
  if (!input.preferences.emailAlertsEnabled) {
    return {
      status: "disabled",
      message: "Daily shortlist email is disabled in Job Search Preferences.",
    };
  }
  if (input.runAlreadyEmailed) {
    return { status: "duplicate", message: "This scheduled run already sent its shortlist." };
  }
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.JOB_DISCOVERY_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return { status: "unavailable", message: "Resend email delivery is not configured." };
  }
  if (!input.to.trim()) {
    return {
      status: "unavailable",
      message: "No authorised email address is available for this user.",
    };
  }

  const now = input.now ?? new Date();
  const shortlist = selectDailyShortlist(input.jobs, now, 10);
  if (!shortlist.length) {
    return { status: "empty", message: "There are no fresh active jobs to include today." };
  }

  const appUrl = env.PUBLIC_APP_URL?.trim();
  const boardLink = appUrl
    ? `<p><a href="${escapeHtml(`${appUrl.replace(/\/$/, "")}/job-board`)}">Open Job Board</a></p>`
    : "";
  const html = `<h1>Your CareerOS daily job shortlist</h1><p>Fresh active matches found today:</p><ol>${shortlist.map(jobLine).join("")}</ol>${boardLink}<p>CareerOS only includes roles it can represent without inventing missing job data.</p>`;

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to.trim()],
        subject: `CareerOS daily shortlist: ${shortlist.length} new match${shortlist.length === 1 ? "" : "es"}`,
        html,
      }),
    });
    if (!response.ok) {
      return { status: "error", message: `Resend returned status ${response.status}.` };
    }
    return { status: "sent", sentAt: now.toISOString() };
  } catch {
    return { status: "error", message: "CareerOS could not deliver the daily shortlist email." };
  }
}
