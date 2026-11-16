# Verification

16 November 2026, Node 22.23.4.

- `npm test`: PASS, 84 assertions exercising all 28 CLI operations on embedded PGlite.
- The same smoke suite: PASS, 84 assertions on a fresh local PostgreSQL 18.6 database. The server and temporary database were removed afterwards.
- `npm run demo -- --keep`: PASS. Three real command captures, three branded views and four documents from fictional records.
- Browser inspection of the contribution view and allocation review pack: readable headings, currency, evidence and amounts.
- Voice checks: no em dashes, author placeholders or banned phrases in authored prose. Brand lint reports no errors.

The smoke suite checks idempotent migrations and demo seeding, refusal to seed a business workspace, import dry-run and replay, complete rollback after a later bad row, mapping validation through the importer, exact-cent largest-remainder allocation, zero activity, fractional quantities, unsaved scenarios, stale sign-offs, closed periods, reopening, append-only evidence, period separation, invalid dates, ambiguous names, CSV edge cases, real CLI exit codes, JSON output and rendered documents.

CI runs the same suite and demo on Windows and Linux, plus the smoke suite against PostgreSQL 17. Local validation runs on Linux; the CI result is recorded separately after the private push. No live customer data or proprietary CostPerform export was used. Example imports use fictional files in the documented mapping contract. No enterprise-volume benchmark is claimed.
