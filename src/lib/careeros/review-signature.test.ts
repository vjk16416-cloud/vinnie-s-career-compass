import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import { runScan } from "./scoring";
import { reviewInputSignature, textSignature } from "./review-signature";

const identity = {
  applicationId: "app-1",
  jobId: "job-1",
  jobDescriptionSignature: "jd-a",
  scanId: "scan-1",
  scanJobDescriptionSignature: "jd-a",
  cvId: "cv-1",
  cvVersionId: "cvv-2",
  coverLetterId: "cl-2",
};

describe("review signatures", () => {
  it("is deterministic and changes when text changes", () => {
    expect(textSignature("same JD")).toBe(textSignature("same JD"));
    expect(textSignature("same JD")).not.toBe(textSignature("changed JD"));
  });

  it("changes when a reviewed artifact changes", () => {
    expect(reviewInputSignature(identity)).not.toBe(
      reviewInputSignature({ ...identity, cvVersionId: "cvv-3" }),
    );
    expect(reviewInputSignature(identity)).not.toBe(
      reviewInputSignature({ ...identity, coverLetterId: "cl-3" }),
    );
  });

  it("stores the saved JD signature on each new scan", () => {
    const data = createCareerOsData();
    const job = data.jobs[0]!;
    expect(runScan(job, data).jobDescriptionSignature).toBe(textSignature(job.description));
  });
});
