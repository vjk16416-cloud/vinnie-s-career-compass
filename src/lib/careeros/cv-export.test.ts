import { describe, expect, it } from "vitest";

import {
  buildWordCompatibleCv,
  coverLetterExportFileName,
  cvExportFileName,
} from "./cv-export";

describe("CV export", () => {
  it("builds a Word-compatible document with safe Times New Roman content", () => {
    const html = buildWordCompatibleCv(
      "Vinnie Jegathees\nGrowth Marketing Manager\n<script>alert('no')</script>",
      "Growth Marketing Manager | Example Co",
    );

    expect(html).toContain("Times New Roman");
    expect(html).toContain("Growth Marketing Manager | Example Co");
    expect(html).toContain("Vinnie Jegathees");
    expect(html).toContain("&lt;script&gt;alert(&#39;no&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert('no')</script>");
  });

  it("creates a safe job-specific Word filename", () => {
    expect(cvExportFileName("Growth / Marketing: Manager", "Example & Co", 3)).toBe(
      "Vinnie_Jegathees_Example_Co_Growth_Marketing_Manager_v3.doc",
    );
  });

  it("creates a safe versioned cover-letter filename", () => {
    expect(coverLetterExportFileName("Growth / Marketing: Manager", "Example & Co", 2)).toBe(
      "Vinnie_Jegathees_Example_Co_Growth_Marketing_Manager_Cover_Letter_v2.doc",
    );
  });
});
