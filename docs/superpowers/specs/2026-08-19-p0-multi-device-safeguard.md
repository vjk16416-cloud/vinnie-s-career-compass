# CareerOS P0 Multi-device Local Data Safeguard

Date: 2026-08-19
Status: Approved P0 design addendum
Parent design: `docs/superpowers/specs/2026-08-18-p0-trust-foundation-design.md`

## Purpose

The original P0 design correctly made Supabase authoritative after authentication, but its Case A rule refreshed localStorage whenever cloud state existed. That is safe only when the browser copy is known to be a previously confirmed cloud cache.

A second device may contain older independent CareerOS data from before cloud persistence. Silently replacing that unmarked browser copy would risk losing work.

## Revised rule

CareerOS now distinguishes between:

- a browser cache explicitly marked as a previously confirmed cloud copy; and
- unconfirmed local CareerOS data with no cloud provenance marker.

When cloud state exists:

1. If the local copy is cloud-confirmed for the same authenticated user, cloud remains authoritative and may refresh the browser cache normally.
2. If an unconfirmed local copy is identical to cloud state, CareerOS may safely mark it as cloud-confirmed and continue.
3. If an unconfirmed local copy differs from cloud state, CareerOS must not overwrite either version automatically.
4. The workspace pauses editing and presents an explicit choice between the cloud version and the local version.
5. Choosing **Keep cloud version** refreshes the browser cache from cloud and marks it as cloud-confirmed.
6. Choosing **Use local version** replaces cloud state only after Supabase confirms the save. If that save fails, neither version is replaced and the choice remains unresolved.

Successful first-device migration also marks the resulting browser cache as cloud-confirmed. Subsequent successful cloud saves retain that provenance.

## Product semantics

Supabase remains the canonical cross-device storage location. The provenance marker does not make localStorage authoritative. It only tells CareerOS whether a local browser copy is known to have come from a successful cloud read or write and can therefore be safely refreshed.

This safeguard applies to CareerOS browser data. It does not copy or synchronise ChatGPT conversations, GitHub repository content, or Google Drive source documents into Supabase.

## Verification requirements

Automated tests must prove:

- divergent unconfirmed local data is preserved when a cloud row already exists;
- successful first-device migration marks the cache as cloud-confirmed;
- cloud data is not selected over divergent local data until the user explicitly chooses it;
- local data replaces cloud state only after a successful explicit Supabase save;
- the complete P0 test suite, targeted formatting/lint checks and production build remain green.
