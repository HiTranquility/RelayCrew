# Bug fix / Sửa lỗi có kiểm chứng

## Required context
Expected behavior, observed behavior, a reproduction or failing case, scope and affected environment. If essential reproduction details are missing, ask the owner. Do not label an unverified suspicion as a confirmed bug.

## Flow
1. Dev inspects relevant code/guidance and reproduces the failure when possible. Establish a failing check for a behavioral regression if appropriate.
2. Make a bounded root-cause fix within the current edit permission; preserve unrelated changes.
3. Run the relevant checks and inspect adjacent regression risk.
4. Audit verifies evidence and reports only concrete remaining findings in its required JSON schema.
5. Repair addresses assigned issues; the primary manager decides based on the owner's acceptance criteria and actual validation.

## Public handoff
State **Cause**, **Fix**, **Reproduction / validation**, **Remaining risk** in the owner's language. Use paths/document references. Important decisions require the `needs_owner` envelope; this file grants no additional permissions.

**Tiếng Việt:** Có bước tái hiện, bằng chứng nguyên nhân và kiểm tra sau sửa. Nếu không thể chạy môi trường thật, nói rõ phần chưa kiểm chứng, không bịa kết quả test.
