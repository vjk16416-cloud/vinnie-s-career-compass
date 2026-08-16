export function isPublicAuthPath(pathname: string): boolean {
  const normalisedPath = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return normalisedPath === "/login" || normalisedPath === "/auth/callback";
}
