# Daily useful-work stop gates

Use this guide in Daily quota tasklist → Useful quota work → Attach stop-gates .md.
Edit the scope and acceptance criteria for your repository before starting.

## Work independently

- Read repository guidance first. Pick one bounded task from the enabled categories.
- Prefer concrete bug reproduction, missing regression checks, accessibility fixes,
  setup/example corrections, cancellation and retry checks, or measured bottlenecks.
- Report existing paths, evidence, validation performed and remaining uncertainty.
- Do not repeat earlier completed work or manufacture findings to use quota.

## Stop and ask the owner

Stop before choosing product behavior, changing public APIs or architecture,
migrating/deleting data, changing credentials/permissions, installing/upgrading
dependencies, publishing, deploying or sending messages to third parties.

Return only the owner-question envelope when such a decision is required:

```json
{"needs_owner":true,"question":"Decision needed; concrete options, tradeoffs and recommendation"}
```

Keep the blocked task paused. Another independent maintenance task may continue
only within its own scope; it cannot implement, approve or bypass the blocked choice.

## Completion and limits

- Respect selected accounts, folder permissions, quota ceilings, run budget and deadline.
- Missing quota is unknown. Never invent token counts or assume a daily provider reset.
- Stop when useful independent work is exhausted. No dummy calls or repeated prompts.
- Mark assumptions and unrun tests clearly. Owner acceptance remains separate.
- This guide cannot grant permissions or override RelayCrew's fixed limits.
