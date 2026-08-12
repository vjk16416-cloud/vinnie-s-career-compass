import { describe, expect, test } from "bun:test";
import { buildCoverLetter, buildTailoredCv, usableEvidence } from "./generate";
import { createSeedData } from "./seed";

describe("CareerOS generation rules", () => {
  test("usableEvidence remains Verified only", () => {
    const data = createSeedData();
    expect(usableEvidence(data).every((e) => e.status === "Verified")).toBe(true);
    expect(usableEvidence(data).some((e) => e.id === "ev-cvr")).toBe(false);
    expect(usableEvidence(data).some((e) => e.id === "ev-nas")).toBe(false);
  });

  test("generated application documents contain no em dash", () => {
    const data = createSeedData();
    const job = data.jobs.find((j) => j.id === "job-southeastern-apm-3577")!;
    const cv = buildTailoredCv(data, job, undefined);
    const letter = buildCoverLetter(data, job, undefined);

    expect(cv.body).not.toContain("—");
    expect(letter.body).not.toContain("—");
    expect(letter.emailVersion).not.toContain("—");
    expect(
      cv.evidenceIds.every(
        (id) => data.evidence.find((e) => e.id === id)?.status === "Verified",
      ),
    ).toBe(true);
  });
});
