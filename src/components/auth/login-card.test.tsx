import "@/test/dom";
import "@/test/setup";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginCard } from "./login-card";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginCard", () => {
  it("presents the private Google-only CareerOS sign-in", () => {
    render(<LoginCard />);

    expect(screen.getByRole("heading", { name: "CareerOS" })).toBeInTheDocument();
    expect(screen.getByText("Private career workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(screen.getByText("Access is limited to vjk16416@gmail.com")).toBeInTheDocument();
    expect(screen.queryByText(/password|magic link|sign up/i)).not.toBeInTheDocument();
  });

  it("shows the unauthorised message and gives keyboard focus to the retry action", () => {
    render(<LoginCard error="unauthorised" returnTo="/settings" />);

    expect(
      screen.getByText("This Google account is not authorised for CareerOS."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This Google account is not authorised for CareerOS.",
    );
    expect(screen.getByRole("button", { name: "Try Google Sign-In again" })).toHaveFocus();
  });

  it("shows a non-secret authentication message with a retry action", () => {
    render(<LoginCard error="authentication" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "CareerOS could not complete Google Sign-In. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Try Google Sign-In again" })).toBeEnabled();
  });

  it("disables the action and announces progress while Google Sign-In starts", async () => {
    let resolveSignIn!: (result: { error: null }) => void;
    const startSignIn = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    render(<LoginCard returnTo="/applications/123" startSignIn={startSignIn} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(startSignIn).toHaveBeenCalledWith("/applications/123");
    expect(screen.getByRole("button", { name: "Opening Google Sign-In…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Opening Google Sign-In…");

    resolveSignIn({ error: null });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled(),
    );
  });

  it("announces an initiation failure and returns focus to the retry action", async () => {
    const startSignIn = vi.fn().mockResolvedValue({
      error: "CareerOS could not start Google Sign-In. Please try again.",
    });
    render(<LoginCard startSignIn={startSignIn} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    const retry = await screen.findByRole("button", { name: "Try Google Sign-In again" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "CareerOS could not start Google Sign-In. Please try again.",
    );
    expect(retry).toHaveFocus();
  });
});
