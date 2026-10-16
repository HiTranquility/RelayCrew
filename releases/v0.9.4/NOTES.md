Provider onboarding and portable layout

- Export/import only validated layout geometry and preferences; no prompts, accounts or secrets.
- Install detects an existing CLI first and asks for confirmation with the exact command before starting an installer.
- Prevent duplicate onboarding requests; show sign-in/connection progress in account cards.
- Separate Antigravity agy provider, stream protocol and native model selection. Existing Gemini accounts remain intact. Read-only runs fail closed without documented deny rules; images are not supported by this adapter yet. See docs/ANTIGRAVITY.md. An authenticated agy run was not available locally.
- Type checking, protocol/security tests and bilingual light/dark UI checks.
