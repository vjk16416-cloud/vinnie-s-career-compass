import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    email: null,
    loading: false,
    signIn: auth.signIn,
    signUp: auth.signUp,
    signOut: auth.signOut,
  }),
}));

import { AuthGate } from "./auth-gate";

describe("CareerOS authentication screen", () => {
  beforeEach(() => {
    auth.signIn.mockReset().mockResolvedValue(undefined);
    auth.signUp.mockReset().mockResolvedValue({ requiresEmailConfirmation: true });
  });

  it("lets a new user create a Supabase account", async () => {
    render(
      <AuthGate>
        <div>Private workspace</div>
      </AuthGate>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alex Taylor" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "new-secret-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create CareerOS account" }));

    await waitFor(() =>
      expect(auth.signUp).toHaveBeenCalledWith(
        "new.user@example.com",
        "new-secret-pass",
        "Alex Taylor",
      ),
    );
    expect(
      await screen.findByText(/check your email to confirm your CareerOS account/i),
    ).toBeInTheDocument();
  });

  it("keeps sign-in available for existing users", async () => {
    render(
      <AuthGate>
        <div>Private workspace</div>
      </AuthGate>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "vjk16416@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(auth.signIn).toHaveBeenCalledWith("vjk16416@gmail.com", "secret-pass"),
    );
  });
});
