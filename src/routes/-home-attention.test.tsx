import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getRouter } from "@/router";
import { AttentionPanel } from "@/routes/index";
import type { AttentionItem } from "@/lib/careeros/home-attention";
import { summariseAttention } from "@/lib/careeros/home-attention";

function renderPanel(items: AttentionItem[]) {
  const router = getRouter();
  const queryClient = new QueryClient();
  render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <AttentionPanel items={items} summary={summariseAttention(items)} />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

afterEach(cleanup);

describe("Home attention panel", () => {
  it("shows an all-caught-up state when nothing needs attention", () => {
    renderPanel([]);
    expect(screen.getByText("All caught up.")).toBeInTheDocument();
    expect(screen.getByText(/Nothing outstanding/)).toBeInTheDocument();
  });

  it("lists attention items with their group label and a link", () => {
    renderPanel([
      {
        id: "deadline-app-1",
        group: "deadline",
        severity: "urgent",
        title: "Deadline today for Product Manager",
        detail: "Example Co · deadline 2026-08-20",
        link: { kind: "application", applicationId: "app-1" },
      },
      {
        id: "evidence-ev-1",
        group: "evidence",
        severity: "attention",
        title: "Delivered programme",
        detail: "Example Co · needs evidence",
        link: { kind: "route", to: "/evidence" },
      },
    ]);

    expect(screen.getByText("2 items outstanding · 1 urgent")).toBeInTheDocument();
    expect(screen.getByText("Deadline")).toBeInTheDocument();
    expect(screen.getByText("Needs evidence")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Open" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/applications/app-1");
    expect(links[1]).toHaveAttribute("href", "/evidence");
  });
});
