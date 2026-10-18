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
Protocol tests and bounded read-only CLI trials have run locally. A successful
trial does not verify which Google email is active.

Sources: [headless protocol](https://www.antigravity.google/docs/cli/headless/),
[permission rules](https://www.antigravity.google/docs/permissions?tab=cli),
[installation](https://www.antigravity.google/docs/install?tab=cli).

Tiếng Việt: thêm tài khoản Antigravity riêng. Các tài khoản Gemini cũ được giữ
nguyên. Chế độ chỉ đọc cần chính sách deny ở trên; thiếu chính sách sẽ dừng trước
khi gọi CLI. Không tự thay đổi cấu hình quyền toàn cục hoặc giả định đã đăng nhập.

## Multiple Google accounts

The installed native `agy` CLI does not expose a supported per-invocation email/account selector. RelayCrew profiles with different email labels therefore share its Google login. **Add multiple accounts** records the emails and a preferred profile; it does not authenticate them. The UI marks the identity as unverified and blocks automatic fallback/rotation between aliases of that login store.

Use **Open CLI account login**, complete the account change yourself in the CLI/browser, then check the connection. If you use `/logout` in the CLI, it clears the shared login; other profiles using it are affected. RelayCrew never exports, copies or swaps OS keyring credentials. Per-profile API keys are a separate authentication option and do not imply access to Google subscription quota.

Tiếng Việt: thêm nhiều email giúp phân biệt profile, không tạo nhiều phiên Google đăng nhập độc lập. CLI đang cài chưa có bộ chọn email qua tham số được hỗ trợ. Bạn cần tự đổi đăng nhập ở CLI/trình duyệt; tự động dự phòng giữa hai nhãn dùng chung phiên bị chặn. Quota chưa có số đo thì vẫn để chưa rõ.


## Read native quota without a model request

**Test connection / Refresh account data** reads the native `agy --print /usage --print-timeout 20s` command. It shows remaining percentages and reset times separately for each model group/window. A disabled window is not zero remaining. No model prompt is submitted.

This report belongs to the shared CLI login. The command does not identify the active email, so RelayCrew cannot assign independent quotas to Google profile labels or use this reading to auto-switch between them. [Native headless commands](https://www.antigravity.google/docs/cli/headless/) and [usage windows](https://www.antigravity.google/docs/cli/commands/usage).

Tiếng Việt: nút kiểm tra/làm mới đọc hạn mức thật bằng lệnh `/usage`, không gọi model. Hiện riêng từng nhóm model, kỳ giới hạn và giờ reset. Do CLI chưa trả email, các profile Google dùng chung số đo; không coi đó là quota riêng của hai email.
