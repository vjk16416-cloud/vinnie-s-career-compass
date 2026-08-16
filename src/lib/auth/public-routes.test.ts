import { describe, expect, it } from "vitest";

import { isPublicAuthPath } from "./public-routes";

describe("public authentication route policy", () => {
  it("keeps canonical and trailing-slash auth routes outside private career state", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/login/")).toBe(true);
    expect(isPublicAuthPath("/auth/callback")).toBe(true);
    expect(isPublicAuthPath("/auth/callback/")).toBe(true);
  });

  it("does not classify private or lookalike paths as public auth routes", () => {
    expect(isPublicAuthPath("/")).toBe(false);
    expect(isPublicAuthPath("/applications")).toBe(false);
    expect(isPublicAuthPath("/login/extra")).toBe(false);
    expect(isPublicAuthPath("/auth/callback/extra")).toBe(false);
  });
});
