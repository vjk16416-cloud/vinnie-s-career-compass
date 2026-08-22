import "@/test/dom";
import "@/test/setup";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JobCaptureContent } from "@/routes/job-capture";

afterEach(cleanup);

describe("Job Capture", () => {
  it("prefills a valid HTTPS job URL without analysing it automatically", () => {
    const analyse = vi.fn();
    render(
      <JobCaptureContent initialUrl="https://www.linkedin.com/jobs/view/123" onAnalyse={analyse} />,
    );

    expect(screen.getByLabelText("Job URL")).toHaveValue("https://www.linkedin.com/jobs/view/123");
    expect(screen.getByRole("button", { name: "Extract job details" })).toBeEnabled();
    expect(analyse).not.toHaveBeenCalled();
  });

  it("shows a paste fallback when extraction is blocked", () => {
    render(
      <JobCaptureContent
        initialUrl="https://example.com/jobs/blocked"
        fallback="The site responded with status 403."
      />,
    );

    expect(screen.getByText("Paste the job description instead")).toBeInTheDocument();
    expect(screen.getByText(/status 403/)).toBeInTheDocument();
    expect(screen.getByLabelText("Job description")).toBeInTheDocument();
  });

  it("never treats a short or unreliable extraction as ready to analyse", () => {
    render(
      <JobCaptureContent
        initialUrl="https://example.com/jobs/partial"
        initialDescription="Too short to be trusted."
      />,
    );

    expect(screen.getByRole("button", { name: "Analyse role" })).toBeDisabled();
    expect(screen.getByText(/at least 40 words/i)).toBeInTheDocument();
  });
});
