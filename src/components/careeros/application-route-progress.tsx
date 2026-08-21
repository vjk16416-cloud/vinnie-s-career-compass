import type { CareerOsData } from "@/lib/careeros/types";
import { deriveApplicationProgress } from "@/lib/careeros/application-progress";
import { applicationGateState, scanMatchesSavedJob } from "@/lib/careeros/review";
import { ApplicationWorkflowProgress } from "./application-workflow-progress";

export function ApplicationRouteProgress({
  pathname,
  data,
}: {
  pathname: string;
  data: CareerOsData;
}) {
  const match = pathname.match(/^\/applications\/([^/]+)$/);
  if (!match) return null;

  const applicationId = match[1];
  const application = data.applications.find((candidate) => candidate.id === applicationId);
  if (!application) return null;

  const job = data.jobs.find((candidate) => candidate.id === application.jobId);
  if (!job) return null;

  const scan = data.scans.find((candidate) => candidate.jobId === application.jobId);
  const cv = data.cvs.find((candidate) => candidate.applicationId === application.id);
  const latestCoverLetter = data.coverLetters
    .filter((candidate) => candidate.applicationId === application.id)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);

  const gateState = applicationGateState({
    data,
    application,
    job,
    scan,
    cv,
  });

  const progress = deriveApplicationProgress({
    hasSavedJob: Boolean(job.description.trim()),
    scanCurrent: Boolean(scan && scanMatchesSavedJob(job, scan)),
    hasEvidenceMap: Boolean(scan?.evidenceMap),
    hasCv: Boolean(cv?.versions.length),
    hasCoverLetter: Boolean(latestCoverLetter),
    gateState,
  });

  return <ApplicationWorkflowProgress stages={progress.stages} nextAction={progress.nextAction} />;
}
