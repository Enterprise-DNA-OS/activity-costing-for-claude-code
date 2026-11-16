# Activity Costing for Claude Code

Own the cost pools, measured activity and customer contribution review. Bring a mapped CostPerform export into a database and ask Claude Code, Codex, OpenCode or Cursor to run the costing desk. MIT licensed.

## Three ways to use it

- **Do it yourself:** install the free version, map your exports and run your own costing review. Hosting and the coding-agent subscription remain your costs.
- **We customise it:** Enterprise DNA brings your CostPerform data across, maps your cost rules and fields, and builds a web front end or different stack when needed.
- **We run it for you:** Omni by Enterprise DNA installs, connects and operates your version. One setup fee, then a retainer. [Book a 30-minute call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=costperform&utm_medium=readme).

## Try the fictional distribution business

```bash
npm install
npm test
npm run demo
```

Node 22 or later. The demo uses a temporary database, prints three real command runs and renders the documents and views. It removes its files afterwards. `npm run demo -- --keep` retains them at the printed temporary path. It never seeds your business database.

## Start your own model

```bash
npm run migrate
node scripts/costing.mjs init --name="Your business" --by="Your name"
```

Read [the switching guide](docs/replace-costperform.md), create a period, then test a mapped export with `import costperform` and `--dry-run`. CostPerform exports are configurable. Our examples are fictional mapping fixtures, not native export captures. Map and reconcile a representative period before cutover.

DATABASE_URL selects a private Postgres database. Without it, DATA_DIR selects embedded PGlite, defaulting to `.data/db`. OUTPUT_DIR controls generated files. Use one business and one trusted operator per workspace. Operator names are recorded labels, not sign-in permissions. Never expose the owner connection through a browser.

## The five weekly jobs

1. `/attention`: assign missing source evidence and overdue allocation reviews.
2. `/drivers`: compare measured consumption with the source export.
3. `/margins` and `/reconcile`: inspect weak customer contribution and unallocated overhead.
4. `/scenario`: try a different pool cost without changing the current model.
5. `/weekly-review`: draft the review, then capture and sign off the agreed calculation.

There are 28 CLI operations and 32 task commands. [Full syntax](docs/cli.md). Every recurring job has a recipe in `.claude/commands/`. AGENTS.md points other coding agents to the same library.

Every positive pool is divided by its measured activity. Largest-remainder rounding preserves whole cents exactly. A pool with no positive consumption stays unallocated, making customer contribution provisional. Input edits advance the model revision; stale calculations cannot be signed or used to close a period. Signed snapshots and their history remain readable after corrections.

## Documents and views

Set your business name, logo and colours in brand.json. `npm run docs` renders a period allocation review pack and internal customer cost statements. `npm run view` renders the week, contribution and reconciliation. `/draft-review` produces a private review draft. `/compliance` checks recorded source references, retention settings and model controls with cited rules. [What the checks mean](docs/compliance.md).

## Ten questions answered today

`/insights` runs these queries. CostPerform has its own reporting and scenario features; this is a list of included analysis, not a claim that its software cannot answer them.

1. Which customers lose money after their activity share?
2. Which pools still have cost nobody consumes?
3. Which allocation bases are overdue for review?
4. Which cost pools have no accountable owner?
5. Which customers receive no overhead allocation?
6. Which customers consume more than half of a cost pool?
7. Which customer segments carry the weakest contribution?
8. Which consumption measurements have no supporting evidence?
9. Which signed calculations have been overtaken by new inputs?
10. Which owners hold the most unallocated cost?

## Your first hour: ten things to ask for

1. Show the cost pools nobody owns.
2. Explain the cost of serving our smallest account.
3. Show which driver measurements are missing.
4. Find negative contributions after support cost.
5. Show the difference between input and allocated overhead.
6. Compare a changed picking cost without saving it.
7. Draft the finance review in our colours.
8. Show which sign-offs became stale after a new export.
9. Add a read-only report by customer segment with `/new-view`.
10. Add our region field to the model and import with `/customise`.

## Scope and operating limits

This base implements one-stage proportional allocation of nonnegative overhead pools to customers or services. It does not import proprietary CostPerform whole-model files, reproduce reciprocal or multi-stage allocations, execute custom formulas, convert currencies, calculate tax or prepare regulatory returns. Credits require a model extension. Connections, collaborative data-entry portals and authenticated approvals need development for your version.

Source references are text pointers, not copies of evidence. JSON export is a readable archive, not a backup restore tool. Keep original source files and tested backups. Only recorded controls are checked; the owner remains responsible for accounting policy, retention, storage and evidence quality. Database owners can bypass application controls. No live customer or vendor system is changed.

[Research](docs/research.md) · [Verification](docs/verification.md) · [Why no front end](docs/why-no-front-end.md)
