# RelayCrew 0.9.0

## Observable work and practical planning

- Surface public agent assignments, handoffs and results in Live Session, with readable audit findings, next actions and manager decisions. Keep exact prompts and technical logs expandable.
- Add multi-task mission cards, recorded phase progress, separate owner Definition of Done, agent assignment tables, saved context/documents and per-task flow diagrams. Future Audit/Manager phases are counted before creation; code completion and ETA are not guessed.
- Replace redundant overview counters with decision/failure inbox, active work, queue, quota follow-ups and next schedule.
- Add inline schedule creation/editing with Timeline / Board / Table, timezone-aware recurrence, estimated windows and per-occurrence acceptance snapshots.
- Add inline daily quota setup/tasks, pending-work priorities, dispatch preview and account eligibility explanations. Important decisions stay paused; independent useful maintenance stays bounded.

## Local / Cloud / third party

- Keep native CLI as the default. Add explicit Local/Cloud HTTP-compatible profiles and Ollama/LM Studio presets, API catalog discovery, optional model pin, SecretStorage API keys, attachments and public streaming.
- The HTTP adapter is read-only with explicit supplied context; it has no filesystem, shell or editing tools. Local denotes endpoint location; server inference can still be cloud-backed.
- Reject credential URLs, unsafe endpoint schemes, redirects, unsupported tool calls, truncated streams and editable HTTP turns. Keep automatic fallback within the same transport/location/endpoint.
- Retain old profile/state compatibility and record transport/location/endpoint on each dispatched step.

## Reliability and validation

- Retry transient Windows file locks during atomic state replacement without unlinking the previous state.
- Validate core behavior against real local HTTP servers, cancellation/limits/SSE/UTF-8/secret masking, schedule recurrence and durable acceptance criteria.
- Check EN/VI dark/light browser interactions, drafts, planner views, account forms and responsive layout. Verify the actual VS Code extension host against a local HTTP chat without paid provider requests.
- Keep all previous VSIX/source archives immutable. The engine remains serial; scheduled windows are estimates and execution requires an active VS Code workspace.

Xem [hướng dẫn điều phối Anh/Việt](../../docs/OPERATIONS.md) để cấu hình Local/Cloud, theo dõi hội thoại, nghiệm thu task, lịch và điều phối quota.
