# Task 4 report: Google sign-in and OAuth callback flow

## Status

Implemented and verified on `agent/careeros-google-auth-implementation`.

## Files changed

- `src/lib/auth/oauth.functions.ts`
  - Adds the client-only Google OAuth start action.
  - Adds validated server callback completion using one request-scoped Supabase client.
  - Maps missing codes, exchange/configuration failures, and disallowed users to non-secret login states.
- `src/lib/auth/oauth.functions.test.ts`
  - Covers provider/options, current-origin callback URL, safe/external `returnTo`, single exchange, same-client authorisation, sign-out, redirects, and code non-disclosure.
- `src/components/auth/login-card.tsx`
  - Adds the dark, Google-only public login card with progress, retry, focus, and live status behavior.
- `src/components/auth/login-card.test.tsx`
  - Covers required copy, absence of alternate auth UI, both callback errors, progress, disabled state, retry, and focus restoration.
- `src/routes/login.tsx`
  - Adds the public `/login` route and allowlisted search-state parsing.
- `src/routes/auth.callback.tsx`
  - Adds the `/auth/callback` route and server-function handoff.
- `src/routes/__root.tsx`
  - Keeps `/login` and `/auth/callback` outside `CareerOsProvider` while retaining the shared query provider and toaster.
- `src/routeTree.gen.ts`
  - Auto-generated route registrations for `/login` and `/auth/callback`.
- `src/test/dom.ts`
  - Adds the minimal jsdom bootstrap required because direct `bun test` does not consume the Vitest jsdom configuration.

## RED evidence

1. Initial focused run before the new modules existed:

   ```text
   bun test src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.test.tsx
   0 pass, 2 fail, 2 module-resolution errors
   ```

2. After compile-only skeletons, the OAuth behavior assertions failed for the intended missing behavior: the provider call count was zero, generic failures returned `null`, and callback handlers did not throw redirects. The component harness also exposed that direct Bun execution had no DOM, which led to the test-only jsdom bootstrap.

3. First UI behavior run after implementation caught a semantic accessibility defect:

   ```text
   13 pass, 1 fail
   Unable to find an accessible element with role "heading" and name "CareerOS"
   ```

   `CareerOS` was then rendered as an actual `h1`.

4. Security self-review added a server-client factory failure case. Before the fix:

   ```text
   9 pass, 1 fail
   Expected TanStack redirect: true; received false
   ```

   The callback now converts request-scoped Supabase construction failures to `/login?error=authentication` without including the OAuth code.

## GREEN and verification evidence

All commands used the required Bun invocation form.

- Focused acceptance:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- test src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.test.tsx
  ```

  Result: `15 pass, 0 fail, 48 expect() calls`.

- Full test suite:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- test
  ```

  Result: `23 pass, 0 fail, 71 expect() calls`.

- Changed-file format check:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- x prettier --check src/lib/auth/oauth.functions.ts src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.tsx src/components/auth/login-card.test.tsx src/routes/login.tsx src/routes/auth.callback.tsx src/routes/__root.tsx src/test/dom.ts
  ```

  Result: all matched files use Prettier style.

- Changed-file lint:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- x eslint src/lib/auth/oauth.functions.ts src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.tsx src/components/auth/login-card.test.tsx src/routes/login.tsx src/routes/auth.callback.tsx src/routes/__root.tsx src/test/dom.ts
  ```

  Result: exit `0`, no lint findings.

- Production build:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- run build
  ```

  Result: exit `0`; client, SSR, and Cloudflare Nitro outputs built successfully.

- Additional strict TypeScript diagnostic:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- x tsc --noEmit
  ```

  Result: all Task 4 diagnostics were resolved. The command remains non-zero only for the unchanged pre-existing `src/lib/auth/policy.ts:14` `TS18048` warning (`path` possibly undefined).

## Commit

- `a5fd4f2` — `feat: add private Google sign-in flow`
- This report is stored in a follow-up additive documentation commit; its SHA is reported in the task handoff rather than self-referenced here.

## Security self-review

- The OAuth start action is wrapped in TanStack Start's `createClientOnlyFn`, so `supabase.client.ts` is not admitted to the server bundle.
- The callback runs through `createServerFn` and creates one request-scoped Supabase client.
- `exchangeCodeForSession` is called once, and `getAuthorisedUser` receives that exact client.
- A null/disallowed identity triggers session clearing before the unauthorised redirect.
- All return paths pass through the established hardened `safeReturnTo`, including the external and backslash protections owned by the policy module.
- Missing codes, exchange failures, request-client configuration failures, and initiation failures use fixed non-secret messages/states.
- Redirect options and UI copy never contain the OAuth code or provider error text.
- No token, code, raw Supabase error, or configuration detail is logged.
- The public login and callback routes do not mount `CareerOsProvider`, preventing private career-state hydration on public auth pages.

## Accessibility self-review

- The page has a semantic `main` landmark and `h1`.
- The only auth action is a native button, supports keyboard activation, has a visible focus ring, and receives focus for retry states.
- Pending state disables the action, changes its accessible label, and includes a decorative hidden spinner.
- Progress and errors are announced through an atomic polite live status region.
- Error text remains visible rather than relying on colour alone.
- Required account restriction text is associated with the sign-in action using `aria-describedby`.

## Concerns and out-of-scope items

- Live Google/Supabase end-to-end OAuth was not exercised because provider provisioning and environment configuration were explicitly out of scope.
- Strict `tsc --noEmit` still reports the pre-existing `safeReturnTo` unchecked-index warning in `src/lib/auth/policy.ts`; Task 4 code itself adds no TypeScript diagnostic and the production build succeeds.
- Build output retains existing non-blocking warnings about `vite-tsconfig-paths`, the deprecated `inputValidator` usage in `job-extract.functions.ts`, and large chunks; none originates in Task 4.

## Fix Round 1

### Status and commit

- Implemented all three review findings in `0c48f26` — `fix: harden OAuth redirect boundaries`.
- The documentation update containing this section is committed additively after the implementation commit; its SHA is reported in the task handoff rather than self-referenced here.

### Finding 1: URL-normalisation return-target bypass

RED coverage added to `src/lib/auth/policy.test.ts` reproduced both classes of bypass:

```text
safeReturnTo("/\t/evil.example")
Expected: "/"
Received: "/\t/evil.example"

safeReturnTo("/applications/../login")
Expected: "/"
Received: "/applications/../login"
```

GREEN implementation in `src/lib/auth/policy.ts`:

- rejects every ASCII code point from `0x00` through `0x20`, plus `0x7f`, anywhere in the target;
- continues to reject external, protocol-relative, and backslash-bearing targets;
- resolves the target against a fixed internal origin;
- verifies the resolved origin;
- applies login, logout, and auth-route rejection to the normalised pathname;
- returns only the normalised pathname, search, and hash.

Regression coverage includes tabs, line feeds, spaces, DEL, blocked dot-segment paths, and a safe dot-segment path that normalises internally.

### Finding 2: trailing-slash public auth routes hydrating private state

RED coverage added to `src/lib/auth/public-routes.test.ts` first established the missing policy module, then failed behaviorally:

```text
isPublicAuthPath("/login")
Expected: true
Received: false

1 pass, 1 fail
```

GREEN implementation:

- adds `isPublicAuthPath`, which removes trailing slashes before comparing the two exact public auth paths;
- uses that policy from `src/routes/__root.tsx` before deciding whether to mount `CareerOsProvider`;
- covers `/login`, `/login/`, `/auth/callback`, and `/auth/callback/` as public;
- confirms private and lookalike child paths remain private.

### Finding 3: whitespace-only callback code escaping the fixed error path

RED coverage added to `src/lib/auth/oauth.functions.test.ts` reproduced the unwanted exchange:

```text
Expected exchangeCodeForSession calls: 0
Received calls: 1
```

GREEN implementation:

- keeps the server-function validator type-safe without rejecting blank strings before the handler;
- treats any code whose trimmed value is empty as missing;
- throws the fixed `/login?error=authentication` redirect before constructing a request client or exchanging the code.

### Fix Round 1 verification

- Focused regression suite:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- test src/lib/auth/policy.test.ts src/lib/auth/oauth.functions.test.ts src/lib/auth/public-routes.test.ts
  ```

  Result: `17 pass, 0 fail, 63 expect() calls`.

- Full test suite:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- test
  ```

  Result: `28 pass, 0 fail, 90 expect() calls`.

- Changed-file format check:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- x prettier --check src/lib/auth/policy.ts src/lib/auth/policy.test.ts src/lib/auth/oauth.functions.ts src/lib/auth/oauth.functions.test.ts src/lib/auth/public-routes.ts src/lib/auth/public-routes.test.ts src/routes/__root.tsx
  ```

  Result: all matched files use Prettier style.

- Changed-file lint:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- x eslint src/lib/auth/policy.ts src/lib/auth/policy.test.ts src/lib/auth/oauth.functions.ts src/lib/auth/oauth.functions.test.ts src/lib/auth/public-routes.ts src/lib/auth/public-routes.test.ts src/routes/__root.tsx
  ```

  Result: exit `0`, no findings.

- Strict TypeScript:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- x tsc --noEmit
  ```

  Result: exit `0`. The prior `safeReturnTo` unchecked-index diagnostic recorded above is resolved by the normalised URL implementation.

- Production build:

  ```bash
  npm --cache /workspace/.npm-cache exec --yes bun -- run build
  ```

  Result: exit `0`; client, SSR, and Cloudflare Nitro outputs built successfully.

### Fix Round 1 security self-review

- No untrusted target is written to a redirect until it has passed raw-character rejection and URL normalisation.
- Normalised targets are required to retain the fixed internal origin.
- Auth-loop exclusions are evaluated on the normalised pathname, preventing dot-segment and embedded-control bypasses.
- Public-route gating handles TanStack's accepted trailing-slash variants without widening the public route set.
- Blank callback codes never reach Supabase and expose only the fixed authentication state.
- Live Google/Supabase end-to-end OAuth remains untested because external provider configuration is explicitly out of scope.
