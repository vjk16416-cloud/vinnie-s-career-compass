import "@/test/dom";
import "@/test/setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CvHealthCheck } from "@/lib/careeros/generate";
import { CvHealthCheckPanel } from "./cv-health-check-panel";

function healthFixture(): CvHealthCheck {
  return {
    compatibility: 78,
    atsCoverage: 71,
    responsibilitiesCoverage: 84,
    evidenceCoverage: 65,
    missingKeywords: ["roadmap"],
    weakBullets: ["- Helped with campaign delivery."],
    unsupportedClaims: [],
    formatting: [
      { rule: "Uses approved document structure", pass: true },
      { rule: "No unsupported claims", pass: true },
    ],
    suggestions: [{ text: "Use the verified stakeholder-management evidence more directly." }],
  };
}

afterEach(() => {
  cleanup();
});

describe("CvHealthCheckPanel", () => {
  it("presents health suggestions as guidance and never claims to apply them", () => {
    const onRegenerate = vi.fn();
    render(<CvHealthCheckPanel health={healthFixture()} onRegenerate={onRegenerate} />);

    expect(
      screen.queryByRole("button", { name: /approve suggestions/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/review notes accepted/i)).not.toBeInTheDocument();
    expect(screen.getByText("Suggested refinements")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Suggestions are guidance only. A fresh draft is regenerated from approved profile items and verified evidence.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create fresh draft" }));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });
});
