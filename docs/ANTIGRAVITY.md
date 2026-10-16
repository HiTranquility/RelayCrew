# Antigravity CLI

Antigravity is a separate provider (`antigravity`, executable `agy`). Existing
Gemini profiles keep their provider, account and executable. Add a new account
instead of changing a saved Gemini profile. Installing the editor is not enough:
use Accounts → Install CLI, approve the displayed command, then Sign in.

Automatic model selection follows the CLI's configured model. Exact slugs are
optional. Streaming responses and public tool names use Antigravity's own event
protocol. Authentication cannot yet be verified silently; use a bounded trial.

The documented CLI does not expose a per-run read-only permission mode.
RelayCrew refuses a read-only run unless the global file
`~/.gemini/antigravity-cli/settings.json` explicitly denies these actions:

```json
{"permissions":{"deny":["write_file(*)","command(*)","unsandboxed(*)","mcp(*)","execute_url(*)"]}}
```

Merge these rules yourself; RelayCrew never rewrites global provider permissions.
These rules also prevent this CLI account from implementing changes. Use a
different CLI for Dev, or separate provider configuration outside RelayCrew.
Image paths are currently rejected for this adapter. UTF-8 attachments work.
The adapter has protocol tests; no authenticated Antigravity execution has been
validated on the development machine because `agy` is not installed.

Sources: [headless protocol](https://www.antigravity.google/docs/cli/headless/),
[permission rules](https://www.antigravity.google/docs/permissions?tab=cli),
[installation](https://www.antigravity.google/docs/install?tab=cli).

Tiếng Việt: thêm tài khoản Antigravity riêng. Các tài khoản Gemini cũ được giữ
nguyên. Chế độ chỉ đọc cần chính sách deny ở trên; thiếu chính sách sẽ dừng trước
khi gọi CLI. Không tự thay đổi cấu hình quyền toàn cục hoặc giả định đã đăng nhập.
