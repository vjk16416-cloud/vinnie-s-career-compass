# CareerOS Authentication

Status: implementation prepared for single-user mode.

## Access model

CareerOS is a private personal application. The only authorised login email is:

`vjk16416@gmail.com`

The current implementation uses Supabase Auth with email and password. The email field is fixed in the login UI and the client validates every authenticated session against the allowlisted address.

## Required environment variables

Set these in the deployment environment, not in source control:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never place a Supabase secret key or service-role key in browser-exposed environment variables.

## Supabase setup still required

A dedicated CareerOS Supabase project must be selected or created before the login can become live. Do not reuse an unrelated project such as Intentionally.

Once the dedicated project exists:

1. Enable email/password authentication.
2. Create the single user `vjk16416@gmail.com` with a strong password.
3. Add the project URL and publishable key to the deployment environment.
4. Keep public sign-up out of the CareerOS UI.
5. Test successful login, failed login, session refresh and sign-out.

## Security boundary

This gate prevents normal unauthenticated use of the CareerOS interface. The current app still contains local/seeded data in the frontend architecture, so this is not yet the final data-security boundary. When CareerOS data moves into Supabase, enable Row Level Security and authorise rows to the authenticated user ID. Google Drive remains the document source/second brain and should not expose credentials through the frontend.

## Future multi-user path

The current allowlist is intentionally one address. A later multi-user release should replace the hard-coded single-user rule with server-side account/role records and RLS policies, without changing the main CareerOS workflow.
