---
description: "Make the model theirs"
---

# Make the model theirs

Read CLAUDE.md, docs/cli.md and the existing migrations. Ask for the business rule and a concrete example if the request lacks one. Write a new numbered migration for a new field, segment or rule. Do not edit an applied migration. Update the CLI, import mapping, reports and command recipe together. Apply with `npm run migrate` to the intended workspace after confirming its period and connection. Run `npm test` using the disposable test workspace before reporting the result.

Preserve closed-period and stale-sign-off checks. Never mix currencies, silently change old snapshots, add live payments or invent measured activity. Show the new field or rule through a real CLI query.
