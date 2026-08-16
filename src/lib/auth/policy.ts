export const ALLOWED_EMAIL = "vjk16416@gmail.com";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && normaliseEmail(email) === ALLOWED_EMAIL;
}

const RETURN_TO_BASE_URL = "https://careeros.invalid";

function hasAsciiControlOrWhitespace(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x20 || codePoint === 0x7f;
  });
}

export function safeReturnTo(value: string | null | undefined): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasAsciiControlOrWhitespace(value)
  ) {
    return "/";
  }

  try {
    const normalised = new URL(value, RETURN_TO_BASE_URL);
    const path = normalised.pathname;

    if (
      normalised.origin !== RETURN_TO_BASE_URL ||
      path === "/login" ||
      path.startsWith("/login/") ||
      path === "/logout" ||
      path.startsWith("/logout/") ||
      path === "/auth" ||
      path.startsWith("/auth/")
    ) {
      return "/";
    }

    return `${path}${normalised.search}${normalised.hash}`;
  } catch {
    return "/";
  }
}
