# Feature delivery / Triển khai tính năng

## Inputs
The owner supplies a bounded outcome, target workspace, relevant documents and Definition of Done. Existing RelayCrew role/account assignments remain in effect. Ask about essential missing requirements before implementation.

## Flow
1. **Dev:** inspect guidance/current code, implement the requested behavior and run relevant checks within existing permissions.
2. **Audit:** review the result and acceptance evidence, returning the mandatory JSON findings and bounded repair tasks. No speculative findings.
3. **Repair, if enabled and needed:** complete only those repairs; report actual validation.
4. **Coordinators, if configured:** give independent read-only recommendations.
5. **Primary manager:** verify evidence and return the mandatory final decision. Owner acceptance remains a separate checklist.

## Communication
Use the owner's language. Public updates should say what changed, evidence/tests, blockers and the next recipient. Keep private reasoning private. An important product/architecture/security/data/breaking-change decision requires an owner question and a stop before acting.

## Done
Every supplied criterion has evidence; relevant validation passes or an explicit limitation is reported; unresolved decisions stay paused; the primary manager has reviewed the result. No publishing, deployment, external messaging or extra delegation is authorized by this document.

**Tiếng Việt:** Dev làm, Audit kiểm, Repair sửa trong phạm vi, quản lý chính tổng hợp và quyết định. Nêu rõ kết quả/bằng chứng/việc tiếp theo; không tự vượt qua quyết định đang chờ người dùng.
