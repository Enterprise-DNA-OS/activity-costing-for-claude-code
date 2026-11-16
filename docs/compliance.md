# Evidence checks and record retention

Checked 16 November 2026. This is an internal management costing model. It does not prepare statutory accounts, tax returns, regulatory returns or payment instructions. A clean check means the recorded controls passed, not that the business is legally compliant.

## Sources and executable checks

| Check | What the command checks | Basis |
|---|---|---|
| EVIDENCE | Every cost pool and customer has a source reference | [IRD record keeping](https://www.ird.govt.nz/records): retain business income and expense records |
| DRIVER-EVIDENCE | Every activity measurement has supporting evidence | Evidence traceability control supporting the same IRD guidance |
| RETENTION | The period's retention review date is at least seven years after its end date | Conservative workspace minimum informed by [IRD](https://www.ird.govt.nz/records) and [AU company records](https://business.gov.au/finance/payments-and-invoicing/record-keeping) |
| OWNER | Every pool has a named owner | Internal model control, not a statutory deadline |
| REVIEW | The recorded review date has not passed | Business-set review schedule, not a statutory deadline |
| UNALLOCATED | Every positive pool cost has positive measured consumption | Internal reconciliation control |
| EMPTY | At least one cost pool and one customer exist | Internal sign-off control |

IRD requires at least seven tax years of records, English or Maori records, and approval for offshore storage. Australian guidance generally requires five years, with seven years for company records and some other records. Some circumstances need longer retention. Use the end of the relevant tax year as the retention anchor, or a later date, and have the business owner set the period's retention review date accordingly. The command cannot verify language approval, storage approval, actual evidence contents or backup durability.

## Model controls

A calculation stores immutable copies of all inputs and outputs. Input edits advance the period revision. Sign-off and close refuse stale calculations and unresolved findings. Reopening a period advances its revision and records a reason. Signatures and history are append-only. Database administrators can still bypass controls; this is one trusted operator's workspace, not an authenticated approval service.

No delete command or automated retention purge exists. Retention review dates never authorize deletion. Keep source files and tested backups separately. Source references are text, not copies of invoices. The JSON archive retains the working model, snapshots, sign-offs, imports and history, but is not a database restore image.
