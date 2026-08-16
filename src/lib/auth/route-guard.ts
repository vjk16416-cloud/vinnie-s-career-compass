import { redirect } from "@tanstack/react-router";

import type { AuthorisedUser } from "./auth.server";
import { safeReturnTo } from "./policy";
import { isPublicAuthPath } from "./public-routes";

type RouteLocation = {
  href: string;
  pathname: string;
};

type CurrentUserGetter = () => Promise<AuthorisedUser | null>;

type GuardCareerOsRouteInput = {
  getCurrentUser: CurrentUserGetter;
  location: RouteLocation;
};

export async function guardCareerOsRoute({
  location,
  getCurrentUser,
}: GuardCareerOsRouteInput): Promise<{ authUser: AuthorisedUser | null }> {
  if (isPublicAuthPath(location.pathname)) return { authUser: null };

  const authUser = await getCurrentUser();
  if (!authUser) {
    throw redirect({
      to: "/login",
      search: { returnTo: safeReturnTo(location.href) },
    });
  }

  return { authUser };
}
