import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import type { AuthorisedUser } from "./lib/auth/auth.server";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, authUser: null as AuthorisedUser | null },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
