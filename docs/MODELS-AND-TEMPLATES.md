# Models, usage and input/response templates

**Model IDs are optional.** Accounts & quota defaults to **Automatic flagship / recommended**. Keep a current, authenticated CLI; available models depend on its account and provider.

- Codex asks app-server `model/list` for the current `isDefault` recommendation before each call. It uses the returned concrete model without a hard-coded generation. This recommendation is not a universal ranking. If discovery fails, the Console records that the existing CLI default is being used.
- Claude passes `best`; Gemini passes `pro`. Their CLIs resolve these aliases according to current availability/settings. Older CLIs may require an update or another optional alias.
- **Follow CLI settings** leaves selection to existing CLI configuration.
- **Custom model (optional)** exposes an ID/alias override. Existing explicit IDs and role overrides are preserved.

The Console records selection source and labels provider aliases. An alias does not prove the exact model that answered. Discovery reads metadata and creates no chat or model turn.

References checked 2026-10-16: [Codex catalog protocol](https://learn.chatgpt.com/docs/app-server), [Claude aliases](https://code.claude.com/docs/en/model-config), [Gemini aliases](https://geminicli.com/docs/cli/cli-reference/).

Choose **Reasoning / usage level**, or leave it empty for CLI defaults. The selected CLI/model validates supported levels. Higher effort can use more quota. Gemini uses native configuration rather than a RelayCrew effort flag.

An optional **Account quota ceiling (%)**, 1–100, preserves usage. Routing, rotation and backlog use the lower account/global threshold; daily work uses the lower account/daily target. Excluded accounts remain excluded. Thresholds are evaluated between steps against observed quota. They do not interrupt an in-flight request or provide a hard token/money cap. Missing/stale observations block automatic rotation/daily/backlog dispatch; manually selected normal tasks retain their existing unknown-quota behavior. Task count budgets and timeouts provide additional bounds.

Open **Setup → Input and response templates**. Choose Dev, Audit, Repair, Primary manager or Coordinator. Start with **Default handoff**, **Thorough code review** or **Concise handoff**, edit both text fields, and **Preview request** using a sample task. Preview is local. **Restore role default** resets that role; **Save all templates** applies to new tasks.

Placeholders: `{{task}}`, `{{assignment}}`, `{{role}}`, `{{workspace}}`, `{{history}}`, `{{owner_replies}}`. Substitution runs once and never evaluates inserted text. Each field accepts 1–8,000 characters. Unknown placeholders are rejected. A sample preview has sample context; runtime evidence can differ.

Audit fields `summary`, `issues`, `tasks` and manager fields `decision`, `summary` remain required. Customize their content/style; the engine still validates these envelopes. Owner decisions use `needs_owner` and pause work. Templates do not grant edit permissions, publishing authority or final approval to coordinators.

Normal, scheduled, backlog, remote and daily tasks capture complete template snapshots/hashes when created. Reports retain them. Existing tasks/replies remain unchanged; connection trials keep bounded trial instructions. Templates live in workspace state and its backups. An optional version-1 `promptTemplates` object in a `relaycrew` Markdown block imports the same settings; omitted roles use built-in defaults. See [the example](workflow.example.md).

## Tiếng Việt

Không cần nhập model ID. Mặc định **Flagship / khuyến nghị tự động** theo danh mục Codex hoặc alias Claude/Gemini; model dùng được phụ thuộc CLI/account. Có lựa chọn theo thiết lập CLI hoặc pin ID/alias nâng cao. Console ghi rõ nguồn lựa chọn và trường hợp phải dùng mặc định CLI.

Chỉnh mức suy luận và ngưỡng quota từng account trong form. Ngưỡng áp dụng giữa các bước, dựa trên quota đã quan sát; không cắt lượt đang chạy hoặc tạo hạn mức tiền/token cứng. Daily vẫn giữ nút loại trừ tài khoản.

Vào **Thiết lập → Mẫu đầu vào và phản hồi** để chọn vai trò, mẫu có sẵn, sửa đầu vào/phản hồi mong muốn, xem trước, khôi phục và lưu. Xem trước không gọi AI. Audit/manager giữ các trường JSON cần điều phối. Tác vụ mới lưu bản chụp và hash; lịch sử cũ được giữ nguyên.

## Role names and per-role Markdown (0.8)

Pencil buttons on account cards and flow nodes open the chosen role directly. Set an optional name (80 characters), attach a UTF-8 `.md` guide (32 KB), or edit its content in place. Save all templates. The name and guide are part of the task template snapshot/hash and report; only the assigned role receives that role-specific guide. Renaming does not change internal Dev/Audit/Repair/Lead permissions or output envelopes. Choosing an input/output preset preserves the name/guide; Restore role default clears that role’s customization. The general conversational chat mode uses its own read-only conversation instructions rather than coding-role templates.
