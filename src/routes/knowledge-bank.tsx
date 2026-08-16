import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeBankPage } from "@/components/careeros/knowledge-bank/knowledge-bank-page";

export const Route = createFileRoute("/knowledge-bank")({
  head: () => ({
    meta: [
      { title: "Knowledge Bank | CareerOS" },
      {
        name: "description",
        content: "Manage the private career facts, achievements and evidence CareerOS uses for resume tailoring.",
      },
    ],
  }),
  component: KnowledgeBankPage,
});
