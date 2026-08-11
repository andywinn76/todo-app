# TODO

## Automated database backups via `pg_dump`

Set up a scheduled job that dumps the Supabase Postgres database every two days and prunes dumps older than 30 days.

- Runs on a cron schedule (every 2 days)
- Uses `pg_dump` custom format (`-Fc`), compressed
- Connection string stored as a secret, never committed
- Dumps written to a private storage location
- Retention step deletes any dump older than 30 days

**Done when:** a restore into a scratch database has been tested successfully from a real dump.

## Live updates on shared lists via Supabase Realtime

Replace refresh-triggered refetching with push-based updates so changes from one user appear on other users' screens immediately.

- Enable Realtime replication on the relevant tables (Database → Replication, or `alter publication supabase_realtime add table ...`)
- Subscribe to `postgres_changes` for `INSERT` / `UPDATE` / `DELETE`, filtered to the currently open list
- Apply incoming payloads to local state rather than refetching the whole list
- Unsubscribe on unmount / list switch — leaked channels count against the 200 concurrent connection limit
- Verify RLS still gates events correctly: a user must not receive changes for lists they can't read
- Handle reconnect after network drop or tab sleep — refetch once on resubscribe so nothing missed while disconnected

**Done when:** two browsers on the same shared list reflect each other's changes without a manual refresh, and a user without access receives nothing.

## Offline notes cache — follow-ups

Notes and Secure Notes now cache locally (`src/lib/offlineCache.js`) so they're readable instantly and edits queue up when offline, syncing (with a conflict warning) once reconnected. Deliberately out of scope for that pass, left here for later:

- **Secure Notes offline editing**: currently read-only offline (cached ciphertext only, decrypts locally via the master password). Saving a secure note still requires a live connection — no pending-edit queue like regular Notes have.
- **Todos / Groceries offline cache**: only Notes/Secure Notes are cached today. Extending the same pattern to todo and grocery lists would need a per-item (not per-list) cache shape.
- **Realtime + offline cache overlap**: once Realtime updates (above) land, the offline cache's reconnect-reconciliation should be re-checked against live push updates so the two don't fight over which version is "current."
