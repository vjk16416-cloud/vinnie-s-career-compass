# CareerOS Single-User Google Authentication Design

**Status:** Approved design, pending written-spec review  
**Date:** 15 August 2026  
**Owner:** Vinnie  
**Allowed account:** `vjk16416@gmail.com`

## 1. Purpose

Protect the private CareerOS application with Google Sign-In and allow access only to Vinnie's verified Google account. This is a personal single-user system, not a public registration product.

## 2. Current state

- The Lovable project is private and not published.
- The project uses TanStack Start and React.
- The application currently has no authentication.
- Career data is currently stored in browser local storage.
- Lovable Cloud database support is not enabled.
- Google Drive integration is not yet active.
- The approved CareerOS documents are mirrored between Google Drive and GitHub.

## 3. Selected approach

Use Supabase Auth, provisioned through Lovable Cloud, with the Google OAuth provider and a server-validated email allowlist.

The browser may display the allowed email for guidance, but it must not be the security boundary. After OAuth returns, the server must obtain the authenticated user from Supabase and compare the normalised verified email to `vjk16416@gmail.com`. Any other account must be signed out and denied access.

Supabase server-side authentication should use the PKCE flow and cookie-backed sessions suitable for an SSR application. Google OAuth credentials must remain in protected configuration and must never be committed to GitHub.

## 4. Authentication flow

1. An unauthenticated visitor requests a protected CareerOS route.
2. CareerOS redirects the visitor to `/login`.
3. The login page presents one action, **Continue with Google**.
4. Supabase starts the Google OAuth flow.
5. Google returns an authorisation code to the configured callback route.
6. The server exchanges the code for a Supabase session.
7. The server retrieves the authenticated user and checks:
   - a user exists;
   - the provider supplied a verified email;
   - the normalised email exactly equals `vjk16416@gmail.com`.
8. If authorised, CareerOS creates the cookie-backed session and redirects to the original safe CareerOS route or the dashboard.
9. If unauthorised, CareerOS signs the user out, clears the session and redirects to `/login?error=unauthorised`.
10. Logout clears the Supabase session and returns the user to `/login`.

Redirect targets must be restricted to internal application paths to prevent open-redirect vulnerabilities.

## 5. Application changes

### Authentication services

Create focused modules for:

- browser Supabase client;
- server Supabase client and cookie handling;
- Google sign-in initiation;
- OAuth callback exchange;
- current-user lookup;
- exact-email authorisation;
- logout.

The authorisation function must be independently testable and must not read from user-editable metadata.

### Routes

Add:

- `/login`, public;
- `/auth/callback`, public callback endpoint;
- `/logout`, authenticated action or endpoint.

Protect every existing CareerOS route except the login and callback routes. Route protection must happen before private page content or local career data is rendered.

### Interface

The login screen should match the existing calm, dark CareerOS workspace style. It should include:

- CareerOS name;
- a short private-workspace explanation;
- **Continue with Google**;
- an unauthorised-account message;
- a retry action.

The application shell should show the signed-in email and provide logout.

## 6. Security requirements

- Allow only `vjk16416@gmail.com`.
- Validate authorisation on the server after OAuth.
- Use the authenticated user's top-level verified email, not `user_metadata`, for the allowlist decision.
- Never expose a Supabase secret key or service-role key to the browser.
- Use publishable client configuration only where browser access is required.
- Store OAuth credentials and server secrets only in protected Lovable or Supabase configuration.
- Use PKCE and cookie-backed sessions for SSR.
- Clear sessions immediately after an unauthorised callback.
- Do not create public sign-up, password, magic-link or account-management interfaces.
- Apply `auth.uid()` ownership checks to any future user-owned database tables. Authentication alone must not be treated as row-level authorisation.
- Enable Row Level Security on every future table exposed through the Data API.
- Do not log tokens, secrets or full OAuth callback parameters.

## 7. Google and Supabase configuration

The implementation must expose the exact callback URL required for Google Auth configuration. Vinnie must complete the one-time provider setup:

1. Create or select a Google Cloud project.
2. Configure the Google Auth Platform consent screen.
3. Configure the app audience for Vinnie's Google account.
4. Create a web OAuth client.
5. Add the Supabase callback URL as an authorised redirect URI.
6. Store the Google client ID and secret in Supabase's Google provider settings.
7. Add the Lovable preview and eventual production URLs to Supabase's allowed redirect URLs.

The application remains in a configuration-required state until these provider settings are present. Missing configuration must produce a clear, non-secret error message.

## 8. Verification

### Automated checks

- Authorisation accepts `vjk16416@gmail.com`.
- Authorisation is case-insensitive after normalisation.
- Authorisation rejects every other email.
- Missing users and missing emails are rejected.
- Unauthenticated protected-route access redirects to `/login`.
- A safe internal return path is preserved.
- External return paths are rejected.
- Logout clears the session.
- No authentication secret appears in the client bundle or repository.

### Manual checks

- Vinnie can sign in with the allowed Google account.
- A different Google account is denied and signed out.
- Refreshing a protected page preserves the session.
- Signing out blocks protected routes.
- Login works on desktop and mobile.
- Preview and production callback URLs behave correctly.
- Existing CareerOS navigation and local data continue to work after login.

## 9. Lovable Technical and Release Checklist

Create a separate checklist, mirrored in Google Drive and GitHub, covering:

- backend provisioning;
- Google provider configuration;
- protected environment variables;
- authentication tests;
- route protection;
- session and logout tests;
- database persistence and RLS;
- preview health;
- mobile and desktop checks;
- error and empty states;
- GitHub and Lovable commit parity;
- build, lint and test results;
- production publication;
- rollback information;
- post-release smoke test.

The checklist begins in DRAFT and becomes APPROVED only after Vinnie's review. Individual items retain explicit states such as NOT STARTED, BLOCKED, IMPLEMENTED and VERIFIED.

## 10. Delivery boundary

This authentication milestone does not:

- migrate local career data into the database;
- implement Google Drive synchronisation;
- publish the application;
- enable additional users;
- add password, magic-link or email-code login;
- mark the wider CareerOS blockers as complete.

## 11. Completion criteria

The milestone is complete only when:

- Supabase backend and Google provider are configured;
- only `vjk16416@gmail.com` can access protected routes;
- unauthorised accounts are denied and signed out;
- sessions and logout work;
- automated and manual verification pass;
- no secrets are committed;
- the Lovable Technical and Release Checklist exists in Google Drive and GitHub;
- GitHub `main` and the Lovable project point to the same verified implementation commit;
- the approved CareerOS checklist records authentication as VERIFIED.

## Sources

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Server-Side Rendering](https://supabase.com/docs/guides/auth/server-side)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase 2026 Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
