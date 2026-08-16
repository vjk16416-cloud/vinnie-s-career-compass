// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloudflare Builds configuration", () => {
  it("targets the existing CareerOS staging Worker by default", () => {
    const config = readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8");
    const rootName = config.match(/^\s*"name"\s*:\s*"([^"]+)"/m)?.[1];

    expect(rootName).toBe("careeros-staging");
  });
});
