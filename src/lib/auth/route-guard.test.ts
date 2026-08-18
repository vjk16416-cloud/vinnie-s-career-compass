import "@/test/dom";
import "@/test/setup";

import { isRedirect } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivateCareerOsProvider } from "./auth-context";
import { guardCareerOsRoute } from "./route-guard";

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };

function location(pathname: string, href = pathname) {
  return { pathname, href };
}

function privateCareerContent(authUser: typeof authorisedUser | null) {
  return createElement(PrivateCareerOsProvider, {
    authUser,
    children: createElement("p", null, "Private career route"),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function expectLoginRedirect(pathname: string, href = pathname) {
  try {
    await guardCareerOsRoute({
      location: location(pathname, href),
      getCurrentUser: () => Promise.resolve(null),
    });
    throw new Error("Expected an unauthenticated request to redirect to login");
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    if (!isRedirect(error)) throw error;
    return error;
  }
}

describe("CareerOS route guard", () => {
  it.each(["/login", "/login/", "/auth/callback", "/auth/callback/"])(
    "leaves %s public",
    async (pathname) => {
      const getCurrentUser = vi.fn();

      await expect(
        guardCareerOsRoute({ location: location(pathname), getCurrentUser }),
      ).resolves.toEqual({ authUser: null });
    },
  );

  it.each([
    "/",
    "/applications",
    "/applications/abc-123",
    "/cvs",
    "/evidence",
    "/job-scan",
    "/market",
    "/profile",
    "/settings",
  ])("requires an authorised user for the current CareerOS route %s", async (pathname) => {
    const redirect = await expectLoginRedirect(pathname);

    expect(redirect.options).toMatchObject({
      to: "/login",
      search: { returnTo: pathname },
    });
  });

  it("fails closed to login when the session lookup itself errors", async () => {
    try {
      await guardCareerOsRoute({
        location: location("/profile"),
        getCurrentUser: () => Promise.reject(new Error("session lookup failed")),
      });
      throw new Error("Expected a failed session lookup to redirect to login");
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (!isRedirect(error)) throw error;
      expect(error.options).toMatchObject({
        to: "/login",
        search: { returnTo: "/profile" },
      });
    }
  });

  it("returns only the server-authorised identity for a protected route", async () => {
    await expect(
      guardCareerOsRoute({
        location: location("/settings"),
        getCurrentUser: () => Promise.resolve(authorisedUser),
      }),
    ).resolves.toEqual({ authUser: authorisedUser });
  });

  it.each([
    ["https://evil.example/path", "/"],
    ["//evil.example/path", "/"],
  ])("never emits an unsafe %s return path", async (unsafeHref, expectedReturnTo) => {
    const redirect = await expectLoginRedirect("/settings", unsafeHref);

    expect(redirect.options.search).toEqual({ returnTo: expectedReturnTo });
  });

  it("does not resolve protected route context before the user lookup resolves", async () => {
    let resolveUser: (user: typeof authorisedUser | null) => void = () => undefined;
    const getCurrentUser = () =>
      new Promise<typeof authorisedUser | null>((resolve) => {
        resolveUser = resolve;
      });
    let settled = false;

    const guard = guardCareerOsRoute({ location: location("/settings"), getCurrentUser }).then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveUser(authorisedUser);
    await guard;
  });

  it("does not mount private local-storage state while protected authentication is pending", () => {
    const getItem = vi.spyOn(Object.getPrototypeOf(window.localStorage), "getItem");

    const view = render(privateCareerContent(null));

    expect(view.queryByText("Private career route")).not.toBeInTheDocument();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("does not mount private local-storage state for an unauthorised protected route", () => {
    const getItem = vi.spyOn(Object.getPrototypeOf(window.localStorage), "getItem");

    const view = render(privateCareerContent(null));

    expect(view.queryByText("Private career route")).not.toBeInTheDocument();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("mounts private local-storage state only after a protected route has an authorised user", async () => {
    const getItem = vi.spyOn(Object.getPrototypeOf(window.localStorage), "getItem");
    const view = render(privateCareerContent(null));

    expect(view.queryByText("Private career route")).not.toBeInTheDocument();
    expect(getItem).not.toHaveBeenCalled();

    view.rerender(privateCareerContent(authorisedUser));

    expect(view.getByText("Private career route")).toBeInTheDocument();
    await waitFor(() => expect(getItem).toHaveBeenCalled());
  });
});
