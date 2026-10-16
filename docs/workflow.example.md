# RelayCrew team workflow

This example uses the built-in profile IDs. Connect and authenticate each CLI first, or replace the IDs with existing profiles. Import this file from **Setup → Import workflow from Markdown** to preview the assignments and diagram.

```relaycrew
{
  "version": 1,
  "flow": ["builder", "auditor", "worker", "lead"],
  "roles": {
    "builder": "codex-main",
    "auditor": "claude-main",
    "worker": "gemini-main",
    "lead": "codex-main"
  },
  "overrides": {},
  "management": {
    "primaryProfileId": "codex-main",
    "coordinatorIds": []
  }
}
```

## Dev — implement / Lập trình

Read repository guidance, summarize acceptance criteria, then make the smallest useful change. Run the checks appropriate to the change. Report changed files, checks and remaining risks.

Đọc hướng dẫn repo, làm rõ tiêu chí nghiệm thu, triển khai thay đổi cần thiết và kiểm tra phù hợp. Báo cáo file đã sửa, kết quả kiểm tra và vấn đề còn lại.

## Audit — review / Kiểm tra

Inspect the implementation and evidence. Report reproducible bugs and bounded repair tasks. Do not edit files. Follow the JSON response format supplied by RelayCrew.

Kiểm tra code và bằng chứng; đưa lỗi có cách tái hiện, chia việc sửa rõ ràng. Không tự sửa file. Dùng định dạng JSON mà RelayCrew yêu cầu.

## Repair — bounded fixes / Sửa lỗi

Fix only assigned findings; verify their acceptance criteria. Report changes and tests to the manager.

Chỉ sửa lỗi được giao, kiểm tra tiêu chí nghiệm thu và báo cáo manager.

## Primary manager — final decision / Quyết định cuối

Review implementation, audit and repairs. Only the primary manager can approve. Supporting coordinators report evidence without approving. Ask the owner before important product, architecture, security, migration or deployment decisions.

Manager chính tổng hợp và quyết định cuối. Coordinator chỉ báo cáo. Dừng hỏi người dùng trước quyết định quan trọng về sản phẩm, kiến trúc, bảo mật, dữ liệu hoặc triển khai.

## Model selection / Chọn model

Empty overrides keep each connected profile's model and effort. To pin a role, add an existing CLI model ID, for example `"builder": {"model": "YOUR_MODEL_ID", "effort": "medium"}` inside `overrides`. Model availability depends on your authenticated account; import validates structure and profile IDs, not provider entitlements.

Để trống overrides sẽ dùng model/effort của profile. Có thể đặt model riêng cho từng vai trò bằng ID mà CLI và tài khoản của bạn hỗ trợ.
