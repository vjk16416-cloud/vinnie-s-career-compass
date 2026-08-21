import "@/test/dom";
import "@/test/setup";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicationWorkflowProgress } from "./application-workflow-progress";

afterEach(cleanup);

describe("ApplicationWorkflowProgress", () => {
  it("shows all six application stages with a clear next action", () => {
    render(
      <ApplicationWorkflowProgress
        stages={[
          { label: "Job", state: "complete" },
          { label: "Match", state: "complete" },
          { label: "Evidence", state: "complete" },
          { label: "CV", state: "current" },
          { label: "Cover Letter", state: "upcoming" },
          { label: "Apply", state: "upcoming" },
        ]}
        nextAction="Create or review the tailored CV"
      />,
    );

    expect(screen.getByText("Application progress")).toBeInTheDocument();
    expect(screen.getByText("Next: Create or review the tailored CV")).toBeInTheDocument();
    expect(screen.getByText("3 of 6 complete")).toBeInTheDocument();
    expect(screen.getByText("Job")).toBeInTheDocument();
    expect(screen.getByText("Match")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("CV")).toBeInTheDocument();
    expect(screen.getByText("Cover Letter")).toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });
});
