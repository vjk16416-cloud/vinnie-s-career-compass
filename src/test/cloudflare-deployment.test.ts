import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("CareerOS Cloudflare deployment contract", () => {
  it("lets Nitro own generated worker entry and asset paths", () => {
    const wrangler = read("wrangler.jsonc");

    expect(wrangler).toContain('"name": "careeros-web"');
    expect(wrangler).toContain('"compatibility_date": "2026-08-16"');
    expect(wrangler).toContain('"nodejs_compat"');
    expect(wrangler).toContain('"observability"');
    expect(wrangler).toContain('"enabled": true');
    expect(wrangler).not.toContain('"main"');
    expect(wrangler).not.toContain('"assets"');
  });

  it("provides a manual preview deployment workflow without committed credentials", () => {
    const workflow = read(".github/workflows/cloudflare-deploy.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("cloudflare/wrangler-action@v3");
    expect(workflow).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(workflow).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(workflow).toContain("secrets.CAREEROS_SUPABASE_PUBLISHABLE_KEY");
    expect(workflow).toContain("https://gieehxdyzcrrmgxnfsxs.supabase.co");
    expect(workflow).not.toMatch(/sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("exposes a self-contained deploy command through package.json", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.deploy).toBe("bun run build && bunx wrangler deploy");
  });

  it("documents Nitro generated configuration and the rollback boundary", () => {
    const docs = read("docs/careeros/cloudflare-deployment.md");

    expect(docs).toContain("migration/independent-careeros-web");
    expect(docs).toContain("careeros-web");
    expect(docs).toContain("gieehxdyzcrrmgxnfsxs");
    expect(docs).toContain(".wrangler/deploy/config.json");
    expect(docs).toContain("Lovable remains available");
    expect(docs).toMatch(/no Cloudflare production hostname has been allocated yet/i);
    expect(docs).toContain("Do not merge to `main`");
  });

  it("does not track a local .env file", () => {
    expect(existsSync(".env")).toBe(false);
    expect(existsSync(".env.example")).toBe(true);
    expect(read(".gitignore")).toContain(".env");
  });
});
