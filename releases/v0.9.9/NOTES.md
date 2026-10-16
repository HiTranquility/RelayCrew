Operational polish and privacy fixes

- Account checks and visible per-account secret management; missing references are reported without showing values.
- Include/exclude filters and persistent pagination for Tasks, Accounts, Daily work/accounts, Projects and Backlog.
- Inline useful backlog, bounded budgets, removal of pending items and retry receipts. Live snapshots/acknowledgements preserve edited drafts and field focus.
- Stop acts on the selected task ID; reply/resume/report/schedule commands open relevant inline controls without task-selection popups.
- CLI live output redacts secrets even across stream chunks. Persisted webview state is allowlisted and credential fields are stripped; JSON replacements use restrictive file modes.
- Telegram/Zalo edits can retain stored credentials by leaving fields blank. Same-identity transport edits preserve conversation context; disconnect deletes credentials. Tests send real messages only when explicitly requested.
- Guide: docs/WORKBENCH-09.md. Voice uses system dictation when the webview lacks speech support; physical microphone and live external messaging credentials were not tested. Antigravity capability restrictions remain documented.
- Validation: 125 tests, strict type checking, bilingual light/dark and narrow UI, drag/resize/persistence, speech event/fallback, filters/pagination/secret-draft guards. Actual isolated VS Code host passed both languages, one local HTTP chat, popup checks and cancellation without a second inference.
