// @vitest-environment node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloudflare Builds configuration", () => {
  it("targets the existing CareerOS staging Worker by default", () => {
    const config = readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8");
    const rootName = config.match(/^\s*"name"\s*:\s*"([^"]+)"/m)?.[1];

    expect(rootName).toBe("careeros-staging");
  });

  it(
    "generates a redirected Wrangler configuration without named environments",
    () => {
      execFileSync("npm", ["run", "build"], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const generatedConfig = JSON.parse(
        readFileSync(
          resolve(process.cwd(), ".output/server/wrangler.json"),
          "utf8",
        ),
      );

      expect(generatedConfig).not.toHaveProperty("env");
    },
    30_000,
  );
});
