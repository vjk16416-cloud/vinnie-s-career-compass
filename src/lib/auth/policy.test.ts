import { describe, expect, it } from "vitest";

import { isAllowedEmail, safeReturnTo } from "./policy";

describe("single-user authorisation policy", () => {
  it("allows only the configured email address", () => {
    expect(isAllowedEmail("vjk16416@gmail.com")).toBe(true);
    expect(isAllowedEmail("  VJK16416@GMAIL.COM ")).toBe(true);
    expect(isAllowedEmail("someone@example.com")).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
  });

  it("allows only safe internal return paths", () => {
    expect(safeReturnTo("/applications/123")).toBe("/applications/123");
    expect(safeReturnTo("/")).toBe("/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo("/auth/callback")).toBe("/");
    expect(safeReturnTo("/logout")).toBe("/");
  });

  it("rejects ASCII control and whitespace normalisation bypasses", () => {
    expect(safeReturnTo("/\t/evil.example")).toBe("/");
    expect(safeReturnTo("/\n/login")).toBe("/");
    expect(safeReturnTo("/applications/123 notes")).toBe("/");
    expect(safeReturnTo("/applications/123\u007fnotes")).toBe("/");
  });

  it("validates the normalised internal URL before returning it", () => {
    expect(safeReturnTo("/applications/../login")).toBe("/");
    expect(safeReturnTo("/applications/../auth/callback")).toBe("/");
    expect(safeReturnTo("/applications/../evidence?view=review#claim")).toBe(
      "/evidence?view=review#claim",
    );
  });
});
