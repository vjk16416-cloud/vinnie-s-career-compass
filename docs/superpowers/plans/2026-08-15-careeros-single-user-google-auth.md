# CareerOS Single-User Google Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect every CareerOS workspace route with Google Sign-In and permit access only to the verified account `vjk16416@gmail.com`.

**Architecture:** Use Supabase Auth provisioned through Lovable Cloud. `@supabase/ssr` provides PKCE and cookie-backed browser/server clients. A server-only authorisation layer validates `supabase.auth.getUser()` and the user's top-level email. TanStack Start route guards prevent private UI and the local-storage-backed CareerOS provider from rendering before authentication, while protected server functions enforce the same rule at the data boundary.

**Tech Stack:** TanStack Start 1.168.x, TanStack Router 1.170.x, React 19, TypeScript, Supabase Auth, `@supabase/ssr`, Vitest, Testing Library, Bun, Lovable Cloud.

## Global Constraints

- Use British English and do not use em dashes in application copy or documentation.
- Allow exactly `vjk16416@gmail.com`; normalise with `trim().toLowerCase()` before comparison.
- Make the server-returned user from `supabase.auth.getUser()` the security source. Never authorise from `user_metadata`, client state, URL parameters or browser storage.
- Use only Supabase URL and publishable key in browser code. Never introduce a service-role key.
- Read environment variables and cookies per request, not at module initialisation time.
- Keep `/login` and `/auth/callback` public. Treat `/logout` as a POST mutation, not a GET mutation.
- Preserve only same-origin internal return paths. Reject protocol-relative paths, absolute URLs and the auth routes themselves.
- Do not migrate CareerOS local-storage data, add public registration, publish the app, add users, or mark unrelated checklist items complete.
- Do not rewrite Git history. Use additive commits on the connected branch so Lovable can sync them.
- Follow test-driven development: write each failing test, run it, implement the minimum change, and run it again.

---

## Task 1: Prepare the authentication test harness and pinned dependencies

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Add exact dependencies using Bun**

Run:

```bash
bun add --exact @supabase/supabase-js @supabase/ssr
bun add --dev --exact vitest @testing-library/react @testing-library/jest-dom jsdom
```

This resolves current compatible releases and records exact versions in `package.json` and `bun.lock`. Do not hand-write floating version ranges.

- [ ] **Step 2: Add test scripts**

Add to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Prove the harness works**

Run:

```bash
bun run test --passWithNoTests
bun run lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock vitest.config.ts src/test/setup.ts
git commit -m "test: add authentication test harness"
```

---

## Task 2: Implement and test the single-user authorisation policy

**Files:**

- Create: `src/lib/auth/policy.ts`
- Create: `src/lib/auth/policy.test.ts`

- [ ] **Step 1: Write failing policy tests**

Cover these exact cases in `src/lib/auth/policy.test.ts`:

```ts
expect(isAllowedEmail("vjk16416@gmail.com")).toBe(true);
expect(isAllowedEmail("  VJK16416@GMAIL.COM ")).toBe(true);
expect(isAllowedEmail("someone@example.com")).toBe(false);
expect(isAllowedEmail(null)).toBe(false);
expect(isAllowedEmail(undefined)).toBe(false);

expect(safeReturnTo("/applications/123")).toBe("/applications/123");
expect(safeReturnTo("/")).toBe("/");
expect(safeReturnTo("https://evil.example")).toBe("/");
expect(safeReturnTo("//evil.example")).toBe("/");
expect(safeReturnTo("/auth/callback")).toBe("/");
expect(safeReturnTo("/logout")).toBe("/");
```

- [ ] **Step 2: Run the tests and confirm RED**

```bash
bun test src/lib/auth/policy.test.ts
```

Expected: failure because the policy module does not exist.

- [ ] **Step 3: Implement the policy**

Create `src/lib/auth/policy.ts` with this public contract:

```ts
export const ALLOWED_EMAIL = "vjk16416@gmail.com";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && normaliseEmail(email) === ALLOWED_EMAIL;
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  const path = value.split(/[?#]/, 1)[0];
  if (path === "/login" || path === "/logout" || path.startsWith("/auth/")) return "/";
  return value;
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

```bash
bun test src/lib/auth/policy.test.ts
```

Expected: all policy tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/policy.ts src/lib/auth/policy.test.ts
git commit -m "feat: add CareerOS email authorisation policy"
```

---

## Task 3: Add Supabase SSR clients and server-side session validation

**Files:**

- Create: `src/lib/auth/config.ts`
- Create: `src/lib/auth/supabase.client.ts`
- Create: `src/lib/auth/supabase.server.ts`
- Create: `src/lib/auth/auth.server.ts`
- Create: `src/lib/auth/auth.functions.ts`
- Create: `src/lib/auth/auth.server.test.ts`
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Write failing server-authorisation tests**

Test `getAuthorisedUser(client)` with a mocked Supabase client:

- returns `{ id, email: "vjk16416@gmail.com" }` for the allowed top-level email;
- accepts case and surrounding whitespace after normalisation;
- returns `null` when `auth.getUser()` returns no user;
- returns `null` for missing email;
- signs out and returns `null` for any other email;
- never reads `user_metadata.email`;
- converts provider errors into an unauthenticated result without logging tokens.

- [ ] **Step 2: Run the test and confirm RED**

```bash
bun test src/lib/auth/auth.server.test.ts
```

- [ ] **Step 3: Add explicit environment configuration**

Create `.env.example`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Ensure `.gitignore` excludes `.env`, `.env.local` and `.env.*.local`, while retaining `.env.example`.

Create `src/lib/auth/config.ts` with functions that read and validate the two values when a client is created. Errors must say `CareerOS authentication is not configured.` and must not include secret or key contents.

- [ ] **Step 4: Create the browser client**

In `src/lib/auth/supabase.client.ts`, call `createBrowserClient(url, publishableKey)` inside `getBrowserSupabase()`. Keep a browser-only singleton, but do not read environment values until the function is called.

- [ ] **Step 5: Create the request-scoped server client**

In `src/lib/auth/supabase.server.ts`, call `createServerClient(url, publishableKey, { cookies: { getAll, setAll } })`. Adapt `getRequestHeader("cookie")` and `appendResponseHeader("Set-Cookie", ...)` from `@tanstack/react-start/server` to the `@supabase/ssr` cookie adapter. Parse and serialise cookies with the helpers exported by `@supabase/ssr`, and preserve each cookie's supplied options.

The server client must be created per request. Do not cache it globally.

- [ ] **Step 6: Implement the security boundary**

In `src/lib/auth/auth.server.ts`, expose:

```ts
export type AuthorisedUser = { id: string; email: string };

export async function getAuthorisedUser(
  supabase = createRequestSupabase(),
): Promise<AuthorisedUser | null>;

export async function requireAuthorisedUser(): Promise<AuthorisedUser>;
```

`getAuthorisedUser` must call `supabase.auth.getUser()`, check `user.email` with `isAllowedEmail`, call `supabase.auth.signOut()` for a disallowed account, and return only the minimal `{ id, email }` object. `requireAuthorisedUser` must throw a typed unauthorised error used by protected server functions.

- [ ] **Step 7: Add server functions**

In `src/lib/auth/auth.functions.ts`, expose:

```ts
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => getAuthorisedUser(),
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = createRequestSupabase();
  await supabase.auth.signOut();
  return { ok: true as const };
});
```

Any existing or future server function that reads or writes private CareerOS data must call `requireAuthorisedUser()` or use equivalent auth middleware. Add this explicit guard to `extractJobFromUrl` because it accepts a private application workflow request.

- [ ] **Step 8: Run focused and full checks**

```bash
bun test src/lib/auth/auth.server.test.ts
bun test
bun run lint
```

- [ ] **Step 9: Commit**

```bash
git add .gitignore .env.example src/lib/auth src/lib/careeros/job-extract.functions.ts
git commit -m "feat: add server-validated Supabase sessions"
```

---

## Task 4: Build the Google sign-in and OAuth callback flow

**Files:**

- Create: `src/lib/auth/oauth.functions.ts`
- Create: `src/lib/auth/oauth.functions.test.ts`
- Create: `src/routes/login.tsx`
- Create: `src/routes/auth.callback.tsx`
- Create: `src/components/auth/login-card.tsx`
- Create: `src/components/auth/login-card.test.tsx`

- [ ] **Step 1: Write failing OAuth-flow tests**

Test that:

- the sign-in request uses provider `google`;
- `redirectTo` points to the current origin plus `/auth/callback`;
- a safe `returnTo` is retained;
- an external `returnTo` becomes `/`;
- callback code is exchanged exactly once;
- an allowed server-returned user is redirected to the safe return path;
- a disallowed user is signed out and redirected to `/login?error=unauthorised`;
- missing code and exchange errors redirect to `/login?error=authentication`;
- callback errors never expose the OAuth code.

- [ ] **Step 2: Run tests and confirm RED**

```bash
bun test src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.test.tsx
```

- [ ] **Step 3: Implement Google OAuth initiation**

The login action must call:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`,
  },
});
```

Handle a configuration or initiation failure with the non-secret message `CareerOS could not start Google Sign-In. Please try again.`

- [ ] **Step 4: Implement the callback on the server**

Use a server function or server route that receives validated `code` and `returnTo`, calls `createRequestSupabase().auth.exchangeCodeForSession(code)`, then calls `getAuthorisedUser` against that same request-scoped client. Throw TanStack Router redirects for the three outcomes:

```ts
throw redirect({ href: safeReturnTo(returnTo) });
throw redirect({ to: "/login", search: { error: "unauthorised" } });
throw redirect({ to: "/login", search: { error: "authentication" } });
```

Clear the Supabase session before the unauthorised redirect.

- [ ] **Step 5: Build the login interface**

`/login` must render before `CareerOsProvider` and include:

- `CareerOS`;
- `Private career workspace`;
- `Continue with Google`;
- `Access is limited to vjk16416@gmail.com`;
- `This Google account is not authorised for CareerOS.` when `error=unauthorised`;
- a retry button after either error state;
- keyboard focus, visible focus styles, disabled progress state and an accessible status message.

Match the existing dark CareerOS colours, typography and spacing. Do not add sign-up, password, magic-link or account-management UI.

- [ ] **Step 6: Run tests and checks**

```bash
bun test src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.test.tsx
bun test
bun run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/oauth.functions.ts src/lib/auth/oauth.functions.test.ts src/routes/login.tsx src/routes/auth.callback.tsx src/components/auth
git commit -m "feat: add private Google sign-in flow"
```

---

## Task 5: Protect every CareerOS route before private state renders

**Files:**

- Modify: `src/routes/__root.tsx`
- Modify: `src/router.tsx`
- Create: `src/lib/auth/route-guard.ts`
- Create: `src/lib/auth/route-guard.test.ts`
- Create: `src/lib/auth/auth-context.tsx`

- [ ] **Step 1: Write failing route-guard tests**

Test that:

- `/login` and `/auth/callback` are public;
- every current CareerOS route is protected;
- an unauthenticated protected request redirects to `/login?returnTo=<safe path>`;
- an authenticated request returns the minimal authorised user;
- an external or protocol-relative return path is never emitted;
- the protected branch does not render `CareerOsProvider` while user lookup is unresolved or unauthorised.

- [ ] **Step 2: Run the tests and confirm RED**

```bash
bun test src/lib/auth/route-guard.test.ts
```

- [ ] **Step 3: Implement root-level protection**

Use `beforeLoad` in `src/routes/__root.tsx` to call `getCurrentUser()` for every route except `/login` and `/auth/callback`. If no user exists, throw a redirect to `/login` with `returnTo: safeReturnTo(location.href)`.

Extend router context from:

```ts
{ queryClient: QueryClient }
```

to:

```ts
{ queryClient: QueryClient; authUser: AuthorisedUser | null }
```

Return the authorised user from `beforeLoad` so protected components receive a server-validated identity.

- [ ] **Step 4: Keep private local data behind the guard**

Refactor `RootComponent` so `/login` and `/auth/callback` render without `CareerOsProvider`. Mount `CareerOsProvider` only in the authenticated branch after the route guard has returned an authorised user. This is required because the provider reads private career data from local storage.

- [ ] **Step 5: Run checks**

```bash
bun test src/lib/auth/route-guard.test.ts
bun test
bun run lint
bun run build
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/__root.tsx src/router.tsx src/lib/auth/route-guard.ts src/lib/auth/route-guard.test.ts src/lib/auth/auth-context.tsx
git commit -m "feat: protect CareerOS routes before rendering"
```

---

## Task 6: Add signed-in identity and POST logout to the application shell

**Files:**

- Modify: `src/components/careeros/app-shell.tsx`
- Create: `src/components/auth/account-menu.tsx`
- Create: `src/components/auth/account-menu.test.tsx`
- Create: `src/routes/logout.tsx`

- [ ] **Step 1: Write failing component and logout tests**

Test that the shell displays `vjk16416@gmail.com`, exposes a `Log out` button, calls only the POST `logout` server function, invalidates auth/router state after success, and navigates to `/login`. Test that a failed logout displays a retryable, non-secret error.

- [ ] **Step 2: Run the tests and confirm RED**

```bash
bun test src/components/auth/account-menu.test.tsx
```

- [ ] **Step 3: Implement the account control**

Read the minimal user from the authenticated route context. Render the email and a button that invokes `logout`, then clears client cache, invalidates the router and navigates to `/login`.

If a `/logout` route is retained for routing convenience, it must render a confirmation that submits POST. It must never sign out during a GET request.

- [ ] **Step 4: Run checks**

```bash
bun test src/components/auth/account-menu.test.tsx
bun test
bun run lint
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/careeros/app-shell.tsx src/components/auth/account-menu.tsx src/components/auth/account-menu.test.tsx src/routes/logout.tsx
git commit -m "feat: add signed-in account and logout controls"
```

---

## Task 7: Provision Lovable Cloud and configure Google Auth

**External systems:** Lovable, Supabase, Google Cloud Console

- [ ] **Step 1: Enable Lovable Cloud backend**

Enable the backend for project `55253611-cfd8-44e0-a350-923e146fd483`. Record the generated Supabase project reference and exact callback URL in the release checklist. Do not create application tables in this milestone.

- [ ] **Step 2: Configure protected project values**

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Lovable's protected project configuration. The publishable key may reach the browser by design; Google client secret and any Supabase secret or service-role key must remain only in provider configuration.

- [ ] **Step 3: Configure Google Auth Platform**

In Google Cloud:

1. select or create the CareerOS project;
2. configure the consent screen;
3. select the audience that permits `vjk16416@gmail.com`;
4. create a Web application OAuth client;
5. add the exact Supabase Google callback URL as an authorised redirect URI.

- [ ] **Step 4: Configure Supabase Google provider**

Add the Google client ID and secret to Supabase Auth provider settings. Add these allowed application redirect URLs:

```text
https://id-preview--55253611-cfd8-44e0-a350-923e146fd483.lovable.app/auth/callback
http://localhost:3000/auth/callback
```

Add the final production callback only after a production URL exists. Do not publish during this task.

- [ ] **Step 5: Record the configuration gate**

Mark backend and provider items `IMPLEMENTED`, not `VERIFIED`, until the authorised and unauthorised end-to-end tests pass.

---

## Task 8: Create and mirror the Lovable Technical and Release Checklist

**Files:**

- Create: `docs/careeros/Lovable_Technical_and_Release_Checklist.md`
- Modify: `docs/careeros/Career_OS_Checklist_2026-08-14.md` only after verification
- Create: matching Google Doc in the approved CareerOS Drive folder

- [ ] **Step 1: Create the DRAFT checklist in GitHub**

Use the exact status vocabulary `NOT STARTED`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `APPROVED`. Include sections for:

- Lovable Cloud backend;
- Google provider configuration;
- environment and secret handling;
- auth policy tests;
- OAuth callback and route protection;
- session persistence and logout;
- database persistence and future RLS gate;
- preview health;
- desktop and mobile checks;
- error, loading and empty states;
- build, lint and test results;
- GitHub and Lovable commit parity;
- publication readiness, rollback commit and post-release smoke test.

Header:

```md
# Lovable Technical and Release Checklist

**Status:** DRAFT  
**Owner:** Vinnie  
**Project:** CareerOS  
**Lovable project:** `55253611-cfd8-44e0-a350-923e146fd483`
```

- [ ] **Step 2: Mirror the checklist to Google Drive**

Create a Google Doc with identical headings, items and status values in folder `1g2QoNSYufggdfjKLbnnYecH_z7iTkyu7`. Add both the GitHub path and Google Doc URL to the checklist's mirror-control section.

- [ ] **Step 3: Compare both copies**

Verify title, item count, section order, statuses, Lovable project ID and allowed email match exactly. Leave both copies as `DRAFT` pending Vinnie's review.

- [ ] **Step 4: Commit**

```bash
git add docs/careeros/Lovable_Technical_and_Release_Checklist.md
git commit -m "docs: add Lovable technical release checklist"
```

---

## Task 9: Run end-to-end verification and prepare the implementation PR

**Files:**

- Modify: `docs/careeros/Lovable_Technical_and_Release_Checklist.md`
- Modify: mirrored Google Doc
- Modify: `docs/careeros/Career_OS_Checklist_2026-08-14.md` only for evidence-backed auth statuses

- [ ] **Step 1: Run the automated quality gate**

```bash
bun test
bun run lint
bun run build
git grep -nE '(service_role|SUPABASE_SERVICE|GOOGLE_CLIENT_SECRET|client_secret)' -- ':!docs/superpowers/plans/*'
git status --short
```

Expected: tests, lint and build exit 0; secret scan returns no credential values; worktree contains only intentional changes.

- [ ] **Step 2: Verify authorised desktop flow**

On the Lovable preview:

1. open a protected route while signed out;
2. confirm redirect to `/login` and safe return path preservation;
3. sign in as `vjk16416@gmail.com`;
4. confirm redirect back to the intended route;
5. refresh the page and confirm session persistence;
6. confirm the shell displays the email;
7. log out and confirm protected routes are blocked.

- [ ] **Step 3: Verify unauthorised flow**

Use a different Google account. Confirm CareerOS signs it out, clears the session, shows the unauthorised message and does not render CareerOS or read local career data.

- [ ] **Step 4: Verify mobile and regression behaviour**

At a 390 x 844 viewport, repeat login, refresh and logout. Then verify existing navigation, job-analysis entry points and local CareerOS data still work after authorised sign-in.

- [ ] **Step 5: Verify GitHub and Lovable parity**

Record the implementation commit SHA from GitHub. Confirm Lovable shows the same SHA and the preview is built from it. If the values differ, mark parity `BLOCKED` and do not approve or merge.

- [ ] **Step 6: Update status documents conservatively**

Mark only evidence-backed checklist items `VERIFIED`. In the main CareerOS checklist, change email authentication from blocked/not started to `VERIFIED` only after all authorised, unauthorised, persistence and logout checks pass. Do not change Drive sync, job analysis, CV generation, reviewer or publication statuses.

- [ ] **Step 7: Commit verification evidence**

```bash
git add docs/careeros/Lovable_Technical_and_Release_Checklist.md docs/careeros/Career_OS_Checklist_2026-08-14.md
git commit -m "docs: record CareerOS authentication verification"
```

- [ ] **Step 8: Open a draft pull request**

Open a PR from the implementation branch to `main` with:

```md
## What changed
- added single-user Google authentication for CareerOS
- protected every private route and relevant server function
- added authorised identity and POST logout
- added automated authentication tests
- created and mirrored the Lovable release checklist

## Verification
- [ ] `bun test`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] authorised Google account verified
- [ ] unauthorised Google account rejected and signed out
- [ ] desktop and mobile preview verified
- [ ] GitHub and Lovable commit parity verified
- [ ] no secrets committed

## Delivery boundary
No local-data migration, Google Drive synchronisation, public registration or production publication.
```

- [ ] **Step 9: Stop for Vinnie's final approval**

Do not mark the PR ready, merge to `main`, approve the DRAFT Lovable checklist or publish the app until Vinnie reviews the evidence and explicitly approves those actions.

## Final self-review

- [ ] Every requirement in the approved design maps to at least one task and verification step.
- [ ] No `TODO`, `TBD`, placeholder URL or placeholder credential exists in executable code.
- [ ] The only authorised email is `vjk16416@gmail.com`.
- [ ] All mutations, including logout, use POST.
- [ ] Private CareerOS state does not render before authentication.
- [ ] Protected server functions enforce authentication independently of route guards.
- [ ] Google Drive and GitHub checklist copies are identical and remain DRAFT until approval.
- [ ] No completion claim is made without fresh test, build, preview and commit-parity evidence.
