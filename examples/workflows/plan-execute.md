# Plan, execute and review / Lập kế hoạch, thực hiện và duyệt

Local preview example. Copy this file, replace the profile IDs with existing accounts, then preview and apply in Setup. This configures future jobs; it does not run a task or grant edit permissions. Set the global child-task ceiling to at least two.

Mẫu cho bản thử cục bộ. Thay ID bằng tài khoản đã có, xem trước rồi áp dụng. File không tự chạy việc hay cấp quyền sửa. Đặt trần nhiệm vụ con toàn cục ít nhất là hai.

```relaycrew
{
  "version": 1,
  "flow": ["builder", "auditor", "worker", "lead"],
  "roles": {
    "builder": "codex-main",
    "auditor": "claude-main",
    "worker": "antigravity-main",
    "lead": "codex-main"
  },
  "overrides": {
    "builder": {"modelPolicy": "flagship", "effort": "medium"},
    "auditor": {"modelPolicy": "cli", "effort": "medium"},
    "worker": {"modelPolicy": "cli"},
    "lead": {"modelPolicy": "flagship", "effort": "medium"}
  },
  "management": {"primaryProfileId": "codex-main", "coordinatorIds": []},
  "delegation": {"workflow": "plan-execute", "mode": "adaptive", "minWorkers": 1, "maxWorkers": 2}
}
```

## Dispatcher / Giao việc

Read project guidance and the owner's scope. Give the planner a concise brief, constraints and acceptance criteria. Do not implement. Đọc hướng dẫn, làm rõ phạm vi rồi giao đề bài cho planner; không tự triển khai.

## Planner / Lập kế hoạch

Create one or two useful, bounded assignments for the configured executor. Respect the owner's permissions and the required JSON task-list contract. Ask the owner if the bounds cannot fit useful work; never pad the plan. Chia một hoặc hai việc rõ phạm vi, bằng chứng và tiêu chí; không thêm việc cho đủ số.

## Executor / Thực hiện

Complete only the assigned task; report file evidence, checks and blockers. No recursive agents or another AI CLI. Chỉ làm phần được giao, báo cáo bằng chứng và vướng mắc.

## Manager / Quản lý

Review all evidence and return the required decision JSON. Important owner decisions pause the flow. A read-only demo must not edit files, run write commands or publish. Tổng hợp bằng chứng, hỏi chủ việc trước quyết định quan trọng; demo chỉ đọc không được sửa hay đăng tải.

For a fixed count, change mode to `fixed` and set both bounds to the same number. Model IDs are optional; pin a supported alias only if needed. More: [user instructions](../../INSTRUCTIONS.md).
