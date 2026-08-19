import { describe, expect, it } from "vitest";

import { extractJobPosting } from "./job-extract.server";

function jsonLdPage(description: string) {
  const jobPosting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Performance Marketing Manager",
    hiringOrganization: { "@type": "Organization", name: "Example University" },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "London",
        addressCountry: "UK",
      },
    },
    employmentType: "FULL_TIME",
    description,
    url: "https://example.com/jobs/123",
  };

  return `<html><head><script type="application/ld+json">${JSON.stringify(jobPosting)}</script></head><body></body></html>`;
}

describe("job extraction completeness", () => {
  it("marks a well-structured full job description Complete and preserves the full cleaned text", () => {
    const description = `
      <p>Join our performance team to lead acquisition for a growing education portfolio across multiple international markets. The role works closely with marketing, admissions, web and agency partners to improve recruitment performance through careful planning, analysis and experimentation.</p>
      <h2>Responsibilities</h2>
      <ul>
        <li>Own paid media budgets across PPC, paid social and display channels.</li>
        <li>Report performance and recommendations to senior stakeholders every month.</li>
        <li>Manage agency delivery, priorities and agreed performance targets.</li>
        <li>Run landing-page and A/B testing programmes with website colleagues.</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>Strong stakeholder management and analytical communication skills.</li>
        <li>Hands-on experience with Google Ads, GA4 and paid social platforms.</li>
        <li>Experience managing significant digital marketing budgets.</li>
        <li>Ability to work across multiple markets and competing priorities.</li>
      </ul>
      <h2>Qualifications</h2>
      <p>Degree-level education or equivalent professional experience is expected.</p>
      <h2>About us</h2>
      <p>We support learners from many countries and value careful, evidence-led decision making. Unique closing sentence preserved for audit.</p>
    `;

    const result = extractJobPosting(jsonLdPage(description), "https://example.com/jobs/123");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect((result as unknown as { completeness?: string }).completeness).toBe("complete");
    expect(result.text).toContain("Unique closing sentence preserved for audit.");
    expect(result.responsibilities.length).toBeGreaterThanOrEqual(3);
    expect(result.requiredSkills.length).toBeGreaterThanOrEqual(3);
  });

  it("marks usable but thin extraction Partial instead of presenting it as high confidence", () => {
    const description = `
      <p>This role supports a busy marketing team and works across campaign planning, reporting, stakeholder coordination, agency communication and digital optimisation. You will help colleagues organise priorities, review performance, prepare recommendations, maintain accurate records, coordinate delivery and contribute to campaign improvement. The successful candidate will be comfortable working with data, communicating clearly, balancing deadlines and learning new systems. The organisation operates across several markets and needs someone who can work independently while collaborating with a broad range of internal and external partners. This paragraph contains enough useful information to review manually but it does not provide clearly separated responsibilities and requirements.</p>
    `;

    const result = extractJobPosting(jsonLdPage(description), "https://example.com/jobs/partial");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect((result as unknown as { completeness?: string }).completeness).toBe("partial");
    expect(result.confidence).toBe("medium");
  });

  it("requires manual input when the page does not contain enough job-description content", () => {
    const result = extractJobPosting(
      jsonLdPage("Short advert. Apply now for a marketing role with our growing team in London."),
      "https://example.com/jobs/short",
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected extraction to require manual input");
    expect(result.reason).toMatch(/readable job description|manual|enough/i);
  });
});
