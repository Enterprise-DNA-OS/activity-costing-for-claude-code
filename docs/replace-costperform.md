# Move the costing review from CostPerform

## Export and map before cutover

1. In CostPerform, use a configured Big Data Export Task for the source records, attributes and period you need. Its [release documentation](https://www.costperform.com/new-features-in-costperform-2022-1-2/) describes choosing records and attributes. An existing Data Entry Job can also supply an [Excel worksheet](https://www.costperform.com/data-entry-using-excel/) containing objects and allocations. Ask your administrator for the export configuration if your account cannot access it.
2. Save the relevant worksheet or exported record set as UTF-8 CSV. This base reads CSV, not XLSX or the proprietary whole-model export. Prepare three sets: cost pools, customer or service objects, and measured driver quantities. Codes must be stable and unique within the period. Separate source costs from calculated results to avoid counting overhead twice.
3. Map your export headings to the fields in `docs/cli.md`. Copy `examples/column-map.json` and edit it to match the actual export. The examples are fictional fixtures in our mapping format, not a claim about universal CostPerform headings. Arbitrary formulas, reciprocal flows, multiple allocation stages and user-defined functions need a separate model conversion.
4. Create an empty business workspace and a period with its currency and retention review date. Import objects and pools before drivers. Every input file is atomic: one bad row rolls it all back. Test with `--dry-run`, then remove that flag to apply the same import.

```bash
npm run migrate
node scripts/costing.mjs init --name="Your business" --by="Your name"
node scripts/costing.mjs add-period --code=2026-10 --name="October costing" --currency=NZD --end=2026-10-31 --retain=2034-03-31 --by="Your name"
node scripts/costing.mjs import costperform your-pools.csv --kind=pools --map=your-pool-map.json --period=2026-10 --by="Your name" --dry-run
```

That import command loads a mapped export in one operation. Repeat for `--kind=objects` and `--kind=drivers` with their mappings. This is not an automatic migration of every CostPerform model. One day is a target for a prepared, compatible model, not a guaranteed migration time.

## What maps

| Kind | Fields | Meaning |
|---|---|---|
| pools | code, name, cost, unit, owner, review, evidence | One overhead pool and its measured driver unit |
| objects | code, name, segment, revenue, direct, evidence | One customer or service with revenue and direct cost |
| drivers | pool, object, quantity, evidence | Measured quantity for one pool and object |

Money is a nonnegative decimal in the period currency, without symbols or thousands separators. Quantity has at most four decimals. Credits and negative revenue require a model extension. No currency conversion is performed. Every pool uses one unit; the importer assumes you have converted quantities to that unit. Missing evidence is rejected. Importing a changed pool or object code updates that row; omitted rows remain, and imports do not delete. Re-importing the exact same file and mapping is a no-op, even if the working records have since changed. Use a new reviewed export for corrections.

## Reconcile before relying on it

Compare object and pool counts, total overhead, total direct cost and total revenue against your source period. Check the driver units and per-customer allocations, including rounding. `reconcile` shows input, allocated and unallocated cents. A positive pool without consumption remains visibly unallocated, so contributions are provisional. Run `compliance`, resolve each finding, `calculate`, review its snapshot, then `sign-off` and `close`.

Keep CostPerform and its source exports until the business owner has compared a complete period. Custom formulas, dashboards, permissions, connectors, schedules, attachments, regulatory returns and vendor audit history do not carry over. Enterprise DNA maps and validates the agreed model as part of your version.
