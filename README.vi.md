# RelayCrew

[English](README.md) · **Tiếng Việt**

**Điều phối nhóm AI lập trình ngay trong VS Code.**

RelayCrew kết nối các CLI Codex, Claude Code và Gemini đã cài trên máy. Bạn chọn tài khoản, model và vai trò; xem từng agent nhận yêu cầu gì, trả lời gì; đặt lịch, theo dõi quota và tạm dừng khi cần quyết định của mình.

Đây là bản phát hành sớm, chạy cục bộ. Không cần tài khoản RelayCrew hay server chung. Test sử dụng CLI/transport giả và Git thật; tài khoản AI, bot/OA và các model cụ thể cần cấu hình và kiểm thử trên môi trường của bạn.

## Bản 0.9.9

Có kéo/chia panel prompt và màn hình agents, Daily nhiều thư mục và quyền riêng, trần theo account/model, quota đo trước/sau, checklist/kết quả từng việc, kiểm tra tài khoản, tìm kiếm–loại trừ, phân trang và backlog trực tiếp. Thêm tài liệu DOCX/ODT, định dạng ảnh và nhập giọng nói qua dictation. Xem [hướng dẫn workbench](docs/WORKBENCH-09.md) để biết chỗ nhập secret, cách dùng và giới hạn thực tế. Antigravity dùng CLI `agy` riêng; tài khoản Gemini cũ được giữ nguyên.

## Các phần chính

- **Model tự động và định mức:** không cần model ID; tự theo danh mục CLI/alias, có mức suy luận và ngưỡng quota từng account. Xem [hướng dẫn model và mẫu](docs/MODELS-AND-TEMPLATES.md).
- **Cài và đăng nhập:** nút Cài CLI, Đăng nhập, Kiểm tra kết nối ngay trên mỗi thẻ. Một account có thể kiêm Dev/Audit; Manager chính dùng lựa chọn duy nhất ở góc phải.
- **Đổi tên vai trò và file .md riêng:** bấm bút cạnh vai trò để sửa prompt, đổi tên và đính kèm hướng dẫn. Tác vụ mới lưu bản chụp.
- **Mẫu đầu vào/phản hồi:** có mẫu theo vai trò, cho sửa trước khi chạy, xem trước không gọi AI, khôi phục và lưu bản chụp theo task.
- **Trò chuyện hoặc giao việc nhóm:** chat dùng một account chỉ đọc; giao việc chạy pipeline. Enter gửi, Shift+Enter xuống dòng; có chọn Ctrl+Enter. Câu chào không chạy kiểm định repo. Xem [hướng dẫn console](docs/CONSOLE.md).
- **Bảng nhiệm vụ:** giao nhiều task vào hàng đợi; xem sơ đồ luồng, phân công agent, tài liệu và checklist nghiệm thu riêng với tiến độ các bước.
- **Tổng quan thực tế:** ưu tiên quyết định/lỗi cần bạn xử lý, việc đang chạy, hàng đợi, quota cần cập nhật và lịch sắp tới.
- **Local / Cloud / bên thứ ba:** CLI vẫn là mặc định. API tương thích hỗ trợ chat/review chỉ đọc, stream, dò danh mục mô hình và khóa lưu SecretStorage; có mẫu Ollama/LM Studio.
- **Lịch và quota:** Timeline / Board / Table, form lịch và kế hoạch ngày ngay trong trang; xem lý do từng account được chạy hay phải chờ, đổi thứ tự việc chưa bắt đầu.
- **Tác vụ:** phân công Dev → Audit → Repair (tùy chọn) → Quản lý chính; xem tiến độ, input, phản hồi công khai, báo cáo và trao đổi giữa các bước.
- **Tài khoản và quota:** account/model thực đang chạy, phần trăm sử dụng, các cửa sổ giới hạn, thời điểm reset và số token nếu nguồn cung cấp. Có nút đổi account theo task.
- **Thiết lập:** giao diện theo theme VS Code, form tài khoản, luồng/model, luân phiên, quota, Markdown và kết nối ngay trong bảng; có nút Lưu và lỗi tại chỗ. Các lệnh cấu hình thường dùng mở cùng bảng thay vì popup.
- **Tasklist quota trong ngày:** chọn tài khoản được dùng, bỏ chọn model yếu/account cần giữ quota, giới hạn số task và ngưỡng sử dụng.
- **Quản lý chính:** thẻ có viền nhấn, nút vai trò tô nổi bật và ô duyệt cuối giúp nhận ra account có quyền duyệt cuối cùng; tối đa bốn điều phối viên phụ chỉ review/báo cáo. Hai account Claude vẫn có vai trò chính/phụ riêng.
- **Dự án:** tự gom task theo project gốc, thấy account đang làm; có thể tự tạo Git worktree cho từng task và chuẩn bị chat Codex ở đúng thư mục đó.
- **Hẹn giờ và nhắn tin hai chiều:** lịch một lần/cron, reminder, Telegram và Zalo OA; người dùng có thể giao việc, hỏi trạng thái và trả lời agent.
- **Lưu dữ liệu:** hàng đợi, lịch, lịch sử quyết định, báo cáo, bản JSON trước đó và snapshot source trước bước được sửa file.

## Cài đặt và bắt đầu

Yêu cầu VS Code **1.96 trở lên**, workspace local đã tin cậy; CLI cần dùng đã cài và đăng nhập riêng. Git cần có trong PATH để sao lưu source và tạo worktree. Build từ source dùng Node.js **22** và npm.

Tải VSIX tại [RelayCrew 0.9.9 prerelease](https://github.com/HiTranquility/RelayCrew/releases/tag/v0.9.9), rồi chọn **Extensions → … → Install from VSIX…**. Hoặc:

```sh
git clone https://github.com/HiTranquility/RelayCrew.git
cd RelayCrew
npm ci
npm run package
code --install-extension relaycrew-0.9.9.vsix
```

1. Mở folder dự án trong VS Code và sidebar **RelayCrew**.
2. Mở **Tài khoản và quota → Thêm tài khoản**, nhập form rồi lưu. Đặt nhãn và đường dẫn CLI; mặc định tự chọn flagship/khuyến nghị, model ID là tùy chọn nâng cao.
3. Mở sơ đồ nhóm, chọn các vai trò, **Quản lý chính** và điều phối viên phụ. Model/reasoning để trống sẽ dùng giá trị của profile.
4. Giao một task nhỏ có tiêu chí hoàn thành rõ ràng. **Cho phép sửa file** mặc định tắt; bật khi muốn Dev/Repair chỉnh code. Audit/điều phối/quản lý vẫn chạy read-only/plan.
5. Dùng **Tạm dừng ngay**, **Tiếp tục hàng đợi**, **Dừng tác vụ**, **Báo cáo** hoặc **Trả lời agent** ngay trên bảng.

Extension chưa phát hành lên VS Code Marketplace. Các bản **0.1.0 / 0.2.0 / 0.3.0 / 0.3.1 / 0.4.0 / 0.5.0 / 0.6.0 / 0.7.0 / 0.8.0 / 0.9.9 / 0.9.9** được giữ riêng trong [release archives](releases/README.md), có ghi nguồn gốc source và SHA-256; không ghi đè bản cũ.

## Tiếng Anh / Tiếng Việt

Chọn ngôn ngữ ở **Thiết lập** hoặc nút ngôn ngữ trên thanh công cụ. `aiTeam.language` có `auto`, `en`, `vi`; `auto` theo ngôn ngữ VS Code. Bảng, sơ đồ, hộp thoại và báo cáo đổi ngay. Tên lệnh Command Palette và nhãn Settings theo **display language của VS Code** qua các file NLS.

Không dịch lại yêu cầu của bạn, phản hồi agent, account label hay model ID. Lỗi kỹ thuật do CLI/provider trả về có thể vẫn ở ngôn ngữ gốc.

## Account, quota và điều phối

Profile là môi trường CLI do bạn cấu hình, chưa tự xác minh email/danh tính đăng nhập. Hai profile khác tên nhưng cùng môi trường đăng nhập vẫn có thể dùng **cùng một account**. Tạo môi trường/config directory riêng theo hướng dẫn của từng CLI rồi khai báo đường dẫn trong form tài khoản. Mở **Lưu secret cho profile** để nhập tên biến và giá trị; các biến môi trường thường nằm trong Settings nâng cao; không đặt token vào repo hay env thường.

Quota hiện lấy từ snapshot thủ công hoặc `quotaFile` JSON local có nguồn và thời điểm quan sát. Dữ liệu quá năm phút hoặc qua mốc reset cần làm mới. Nếu có nhiều cửa sổ (ví dụ phiên ngắn và tuần), dùng tỷ lệ cao nhất. Không tự chuyển phần trăm thành số token và không coi dữ liệu thiếu là 0%.

**Đổi tài khoản khi chạm ngưỡng**, **Tiếp tục khi quota phục hồi** và **Thử lại bước provider đã báo limit** là các tùy chọn riêng. Thử lại bước bị limit có thể gặp file đã sửa dở; cần snapshot mới xác nhận còn capacity. Tối đa ba lần CLI báo limit trên một bước. Luân phiên chỉ dùng pool account/model mà bạn đã chọn.

Quản lý chính được pin theo task, không tự nhường quyền duyệt cho account phụ khi hết quota. Đổi Lead của task là hành động chủ động sau khi pause. Những bước đã xong giữ nguyên lịch sử account/model.

## Chạy việc hữu ích trong ngày

1. Thêm task thật, chọn account nhận việc.
2. Bắt đầu kế hoạch ngày: chọn account tham gia, ngưỡng quota **1–100%**, tối đa **1–200 task**, thư mục làm việc và múi giờ.
3. Bỏ chọn account/model không muốn dùng. Việc loại trừ áp dụng cả bước quản lý/điều phối; nếu quản lý chính bị loại hoặc hết quota, bước duyệt sẽ chờ.
4. Giữ tùy chọn làm việc độc lập để review code, UI/UX, phím tắt, conventions và CI/CD khi đang chờ quyết định. Mỗi loại tối đa một lần/account/ngày; hết việc hữu ích thì dừng, không gọi yêu cầu rỗng để đốt token.
5. Khi agent trả `needs_owner`, câu hỏi được ghi vào **Nhật ký quyết định** và task dừng. Trả lời ở bảng hoặc kênh nhắn tin đã kết nối. Việc độc lập không được làm thay quyết định đang chờ.

Khả năng nhận ra “quyết định quan trọng” phụ thuộc agent tuân thủ giao thức; extension không bảo đảm tự hiểu hết ý nghĩa mọi thay đổi. Budget tính theo task, gồm các bước review, không phải trần token/tiền chính xác. Lệnh đã chạy có thể vượt ngưỡng trước lần cập nhật quota tiếp theo.

Kế hoạch hết hạn vào nửa đêm theo múi giờ đã chọn, hoặc hết số task. Task cuối trong budget có thể chạy xong; đến nửa đêm thì pause phần đang chạy. **Quota provider vẫn reset theo cửa sổ thật của provider**, không giả định reset hàng ngày. Ngày mới cần bật kế hoạch lại; task ngày cũ/khác project không tự chạy lại. Khi bắt đầu ngày mới, có thể chủ động chọn task dở cùng project/account để chuyển tiếp; chúng tính vào budget mới và giữ nguyên câu hỏi đang chờ.

Task ngày mặc định read-only. Muốn task mới được sửa nhỏ phải bật **cả tùy chọn sửa trong ngày lẫn Cho phép sửa file toàn cục**. Tắt quyền sửa sẽ pause công việc ngày; bật lại không tự cấp quyền cho task đã tạo read-only. Task lỗi/interrupted cần xem lại trước khi tiếp tục dùng account đó.

## Dự án, folder và Codex

Trong **Dự án**, bật **Tạo Git worktree riêng cho mỗi tác vụ mới** (`aiTeam.isolateTasks`) nếu muốn mỗi task tự có folder và branch riêng. Worktree được tạo trước khi gọi agent, từ **HEAD đã commit**. Source còn thay đổi chưa commit/untracked sẽ dừng để bạn commit hoặc stash; extension không tự cất hay sửa phần việc của bạn.

Folder task nằm trong vùng lưu trữ của workspace extension, ngoài repo gốc. Dev/Audit/Repair/Quản lý của cùng task cùng làm trên checkout đó. Bảng hiển thị đường dẫn và branch, có nút mở folder hoặc mở chat Codex tại folder task. Không tự merge, xóa checkout hay xóa branch; bạn kiểm tra diff rồi tích hợp kết quả. Giữ extension storage khi còn cần các worktree này.

Tùy chọn **Chuẩn bị chat Codex desktop cho mỗi tác vụ mới** (`aiTeam.openTasksInCodex`) mở chat một lần lúc bắt đầu task. Cần cài desktop app. [Deep link chính thức](https://learn.chatgpt.com/docs/reference/commands) gắn đúng folder, **không tự gửi prompt**, không đổi account desktop và không đồng bộ hội thoại CLI. RelayCrew vẫn chạy pipeline CLI riêng.

Phần **tự tạo nhóm Projects ở sidebar Codex** chưa có API công khai được xác minh để tích hợp; bản này chưa làm được phần đó. Không sửa database nội bộ của Codex. Xem [chi tiết tích hợp](docs/PROJECTS.md).

## Hẹn giờ, nhắn tin và sao lưu

- [Telegram / Zalo hai chiều](docs/CONNECTIONS.md): bot/OA token, allowlist, webhook ký số, các lệnh và trạng thái gửi.
- [Vận hành và khôi phục](docs/OPERATIONS.md): pause/resume, retry, snapshot và dữ liệu.
- [Kiến trúc](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [changelog](CHANGELOG.md).

Telegram cần bot riêng và chat/user ID được phép. Zalo dùng Official Account/OpenAPI; bạn cung cấp HTTPS forwarding đến webhook local. Kênh chưa hoạt động trước khi cấu hình credential. Lịch mặc định theo múi giờ hệ thống; **VS Code phải mở**. Task tự động trễ quá 60 giây được bỏ qua.

Pause dừng cây tiến trình và giữ file đã sửa, không rollback lệnh đã xong. Resume có thể chạy lại bước dở. State/báo cáo/history là dữ liệu local; snapshot Git tracked/non-ignored không phải backup database nhất quán hay sao lưu ngoài máy. Database đang chạy, file ignored, symlink và submodule cần xử lý riêng.

## Cấu trúc và phát triển

```text
src/core/       # Engine, policy quota/ngày, project và kiểu dữ liệu
src/host/       # VS Code commands, cấu hình, lịch và điều phối
src/adapters/   # CLI, quota, Telegram/Zalo
src/storage/    # State, snapshot và Git worktree
src/ui/         # Bảng, sơ đồ và hộp thoại
test/           # Test tự động và native host smoke
scripts/        # Build, package, preview, verify release
releases/       # Các bản lưu độc lập
```

```sh
npm ci
npm run check
npm test
npm run build
npm run preview
npm run package
npm run releases:verify
```

F5 mở Extension Development Host. Native smoke: `node scripts/smoke.mjs /absolute/path/to/code-executable`. Browser QA tùy chọn dùng Playwright với `npm run test:ui`; không cần Playwright để chạy unit test hay dùng extension. Xem [validation](docs/VALIDATION.md) và [contributing](CONTRIBUTING.md).

Hiện mỗi workspace chạy tuần tự; chưa có agent song song, app-server hai chiều, tự publish issue/PR/deploy, đăng nhập provider tự động hay thực thi khi VS Code đóng. Nhãn model trong demo không bảo đảm model đó có trên account của bạn.

## Giấy phép

[MIT](LICENSE) · Copyright (c) 2026 HiTranquility.

## Tài khoản thật, file đính kèm và luồng Markdown (0.6)

Vào **Tài khoản và quota → Thêm tài khoản** để nhập CLI/model, tìm CLI đã cài, chọn thư mục đăng nhập riêng và gán vai trò trực tiếp. **Thiết lập → Kết nối CLI thật & chạy thử** lưu cấu hình và chạy Dev → Audit → manager chỉ đọc bằng tài khoản đã đăng nhập.

**Nhập luồng từ Markdown** đọc file hướng dẫn, kèm khối cấu hình nếu muốn đặt tài khoản/model/manager không cần chọn từng node. Xem [hướng dẫn](docs/QUICKSTART.md) và [file mẫu](docs/workflow.example.md). Console hỗ trợ chọn/kéo thả file, Ctrl+V dán ảnh, sao chép câu trả lời/báo cáo và ẩn/hiện các vùng. [Giới hạn file và lưu trữ](docs/CONSOLE.md).

Xem [hướng dẫn điều phối Anh/Việt](docs/OPERATIONS.md) để theo dõi hội thoại agent, nghiệm thu task, thiết lập lịch và Local/Cloud. Engine hiện chạy lần lượt; phần trăm là tiến độ bước, khung lịch là dự kiến.

**Bộ mẫu 0.9.9:** [Hướng dẫn vai trò, luồng và đầu bài/nghiệm thu](examples/README.md), đi kèm VSIX. Mở **Thiết lập → Mẫu đầu vào và phản hồi → Mẫu Markdown**, sao chép/chỉnh file rồi nhập vào vai trò hoặc workflow.
