/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";

import type { AuthorisedUser } from "./auth.server";
import { CareerOsProvider } from "../careeros/store";

const AuthUserContext = createContext<AuthorisedUser | null>(null);

export function AuthUserProvider({
  user,
  children,
}: {
  user: AuthorisedUser;
  children: ReactNode;
}) {
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}

export function useAuthUser(): AuthorisedUser {
  const user = useContext(AuthUserContext);
  if (!user) throw new Error("useAuthUser must be used inside AuthUserProvider");
  return user;
}

export function PrivateCareerOsProvider({
  authUser,
  children,
}: {
  authUser: AuthorisedUser | null;
  children: ReactNode;
}) {
  if (!authUser) return null;

  return (
    <AuthUserProvider user={authUser}>
      <CareerOsProvider userId={authUser.id}>{children}</CareerOsProvider>
    </AuthUserProvider>
  );
}
