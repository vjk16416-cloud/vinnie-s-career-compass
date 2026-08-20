import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/careeros/profile-page";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Career Profile — CareerOS" },
      {
        name: "description",
        content: "Structured career profile, employment and reusable evidence from the canonical CareerOS data model.",
      },
      { property: "og:title", content: "Career Profile — CareerOS" },
      {
        property: "og:description",
        content: "The canonical career record and evidence behind every scan and tailored document.",
      },
    ],
  }),
  component: ProfilePage,
});
