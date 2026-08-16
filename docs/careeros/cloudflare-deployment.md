# CareerOS Cloudflare Deployment

Date: 2026-08-16

Repository: `vjk16416-cloud/vinnie-s-career-compass`

Deployment branch: `migration/independent-careeros-web`

Configured Cloudflare Worker name: `careeros-web`

Supabase project ref: `gieehxdyzcrrmgxnfsxs`

## Current deployment state

CareerOS is configured for an independent Cloudflare deployment, but no Cloudflare production hostname has been allocated yet. This repository does not contain Cloudflare account credentials, and this ChatGPT workspace does not have a connected Cloudflare account action capable of creating the Worker or setting GitHub Actions secrets.

The current application build uses Nitro's `cloudflare_module` preset and has been repeatedly verified to produce:

- Worker entry: `.output/server/index.mjs`
- Static assets: `.output/public`

`wrangler.jsonc` points directly to those verified build outputs.

## Required GitHub Actions secrets

The manual `CareerOS Cloudflare Deploy` workflow expects these repository secrets:

- `CLOUDFLARE_API_TOKEN`, a Cloudflare API token authorised to deploy Workers for the intended account.
- `CLOUDFLARE_ACCOUNT_ID`, the target Cloudflare account ID.
- `CAREEROS_SUPABASE_PUBLISHABLE_KEY`, the enabled browser-safe publishable key for `careeros-production`.

Never store the Supabase service-role key, a Cloudflare API token, or any other secret in browser code, `wrangler.jsonc`, committed `.env` files, documentation, or source files.

## Deployment sequence

1. Keep the migration isolated on `migration/independent-careeros-web`.
2. Add the three required GitHub Actions secrets through repository settings or an authorised secrets-management integration.
3. Run the `CareerOS Cloudflare Deploy` workflow manually.
4. Record the actual Cloudflare preview hostname returned by the successful deployment.
5. Create and confirm the first CareerOS account through the supported Supabase Auth Create account flow.
6. Complete the canonical Vinnie data import against that real Auth user UUID.
7. Complete the multi-user RLS verification and preview smoke tests.
8. Only after those checks, decide whether to promote the independent deployment and merge the migration.

## Rollback and safety

Do not merge to `main` until independent preview verification is complete.

Lovable remains available as an optional backup/editor during the migration. It is not the production authentication, production database or intended production-hosting dependency.

The current `main` branch and existing Lovable-accessible version remain untouched, providing a rollback path while the independent deployment is verified.

## What is not claimed yet

- No Cloudflare Worker deployment is claimed as successful yet.
- No Cloudflare hostname is claimed yet.
- No custom production domain is claimed yet.
- No Vinnie production data import is claimed yet because `vjk16416@gmail.com` does not yet exist in the new Supabase Auth project.

These items become complete only after their respective external-system actions succeed and are verified.
