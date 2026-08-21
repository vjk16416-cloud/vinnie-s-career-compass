import { describe, expect, it } from "vitest";
import type { JobRecord } from "@/lib/careeros/types";
import { selectMasterCvFamily } from "./master-selector";

function job(title: string, description: string): JobRecord {
  return {
    id: "job-1",
    company: "Example",
    title,
    location: "London",
    description,
    createdAt: "2026-08-21T00:00:00.000Z",
    sourceType: "paste",
  };
}

describe("master CV family selection", () => {
  it("selects the product family for a product-management vacancy", () => {
    expect(
      selectMasterCvFamily(
        job(
          "Associate Product Manager",
          "Own product roadmap, customer outcomes, product discovery, stakeholders and feature delivery.",
        ),
      ),
    ).toBe("Product / Product Management");
  });

  it("selects the project family for a PMO/project-delivery vacancy", () => {
    expect(
      selectMasterCvFamily(
        job(
          "PMO Analyst",
          "Support project governance, RAID logs, reporting, milestones, dependencies and programme delivery.",
        ),
      ),
    ).toBe("Project / PMO / Delivery");
  });
});
