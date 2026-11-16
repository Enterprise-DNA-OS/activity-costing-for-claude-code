# One CLI

Node 22 or later. `npm run migrate`, then `node scripts/costing.mjs help`. Every operation accepts `--json`. Flags use `--key=value`; unknown flags and extra arguments fail. Names are case-insensitive, identifiers support prefixes, and ambiguous matches print the candidates and exit 1. Exact codes take precedence.

Every period operation takes `--period=CODE`. Mutations require `--by="Operator name"`, a recorded label rather than authentication. One business and one trusted operator per workspace. The PostgreSQL connection must use its private database owner role; public roles have no access. All CLI transactions serialize mutations through the workspace lock. Read operations use read-only transactions.

Money inputs are decimal amounts with at most two places. Stored and JSON values ending `_cents` are whole minor units in the period currency. Human tabular output converts those fields to two decimal amounts. No tax or currency conversion is performed. Quantities have at most four decimal places. Allocation uses proportional weights, floors to cents, then distributes leftover cents by fractional remainder and object code. A zero-consumption pool stays unallocated.

## Operations

- **init:** Start a business workspace. `node scripts/costing.mjs init --name="Your business" --by="Your name"`
- **add-period:** Open a costing period. `node scripts/costing.mjs add-period --code=2026-10 --name="October costing" --currency=NZD --end=2026-10-31 --retain=2034-03-31 --by="Your name"`
- **periods:** List periods and currencies. `node scripts/costing.mjs periods`
- **add-object:** Add a customer or service. `node scripts/costing.mjs add-object --code=ACME --name="Example customer" --segment=Retail --revenue=1000 --direct=600 --evidence="Source ledger reference" --period=PERIOD --by="Your name"`
- **add-pool:** Add an overhead pool. `node scripts/costing.mjs add-pool --code=SUPPORT --name="Account support" --cost=1000 --unit=minutes --owner="Pool owner" --review=2026-12-01 --evidence="Cost ledger reference" --period=PERIOD --by="Your name"`
- **set-driver:** Record measured consumption. `node scripts/costing.mjs set-driver POOL OBJECT --quantity=10 --evidence="Measurement reference" --period=PERIOD --by="Your name"`
- **review-pool:** Review the allocation basis. `node scripts/costing.mjs review-pool POOL --owner="Pool owner" --review=2026-12-01 --evidence="Reviewed basis reference" --period=PERIOD --by="Your name"`
- **pools:** Review pool cost and ownership. `node scripts/costing.mjs pools --period=PERIOD`
- **objects:** List customers and services. `node scripts/costing.mjs objects --period=PERIOD`
- **drivers:** Inspect measured activity. `node scripts/costing.mjs drivers --period=PERIOD`
- **allocations:** Explain who received each pool cost. `node scripts/costing.mjs allocations --period=PERIOD`
- **margins:** Review customer contribution. `node scripts/costing.mjs margins --period=PERIOD`
- **attention:** Find missing measurements and overdue reviews. `node scripts/costing.mjs attention --period=PERIOD`
- **compliance:** Check evidence and retention settings. `node scripts/costing.mjs compliance --period=PERIOD`
- **reconcile:** Reconcile input and allocated cost. `node scripts/costing.mjs reconcile --period=PERIOD`
- **insights:** Answer ten costing questions. `node scripts/costing.mjs insights --period=PERIOD`
- **scenario:** Try a changed pool cost without saving it. `node scripts/costing.mjs scenario POOL --cost=1200 --period=PERIOD`
- **calculate:** Capture an immutable calculation. `node scripts/costing.mjs calculate --period=PERIOD --by="Your name"`
- **runs:** List calculation versions and sign-offs. `node scripts/costing.mjs runs --period=PERIOD`
- **sign-off:** Record approval of a reviewed calculation. `node scripts/costing.mjs sign-off RUN --reason="Compared with source records" --period=PERIOD --by="Your name"`
- **close:** Close a reviewed period. `node scripts/costing.mjs close RUN --reason="Period approved" --period=PERIOD --by="Your name"`
- **reopen:** Reopen a closed period with a reason. `node scripts/costing.mjs reopen --reason="Late source correction" --period=PERIOD --by="Your name"`
- **log-note:** Record a review note. `node scripts/costing.mjs log-note --text="Review note" --period=PERIOD --by="Your name"`
- **history:** Read the change history. `node scripts/costing.mjs history --period=PERIOD`
- **import:** Bring in mapped CostPerform exports. `node scripts/costing.mjs import costperform FILE.csv --kind=pools --map=MAP.json --period=PERIOD --by="Your name" --dry-run`
- **export:** Archive a readable model and its evidence. `node scripts/costing.mjs export --period=PERIOD`
- **draft-review:** Draft the weekly finance review. `node scripts/costing.mjs draft-review --period=PERIOD`

## Imports

Default mapping fields and case-sensitive CSV headings:

- pools: code=Code, name=Name, cost=Cost, unit=Unit, owner=Owner, review=Review Due, evidence=Evidence
- objects: code=Code, name=Name, segment=Segment, revenue=Revenue, direct=Direct Cost, evidence=Evidence
- drivers: pool=Pool, object=Object, quantity=Quantity, evidence=Evidence

A mapping file must contain exactly that kind's field keys with unique string headings. All fields must be present and nonempty. Imports upsert by stable pool or object code and by pool/object pair for drivers. A file is atomic and an exact file/mapping repeat is a no-op. A changed file invalidates prior sign-offs by advancing the revision. `--dry-run` exercises the full import and rolls it back. It never changes the model, history or import ledger.

## Review and lifecycle

`calculate` saves the complete inputs, allocations, margins, findings and reconciliation as an immutable snapshot and returns its ID. `export` lets the reviewer read that snapshot alongside history. `sign-off RUN` requires a current revision and no findings, then records the reviewer and reason. `close RUN` additionally requires a recorded sign-off. `reopen` preserves old snapshots and makes them stale. Source edits cannot change closed periods through this CLI. Direct database owners remain trusted.

`scenario POOL --cost=AMOUNT` changes one pool cost in memory for comparison. It returns exact-cent shares and never saves. `insights --question=1` through `10` selects one of the included queries. Margins exclude any unallocated pool cost, so always read them alongside reconciliation.

`export` writes a private JSON archive under exports/. `draft-review` writes branded HTML under drafts/. `OUTPUT_DIR` changes the private output root. JSON archives are not database restore files. Keep tested database backups separately.
