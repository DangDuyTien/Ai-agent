## Prompt 1: Rà soát tác động lên codebase hiện có

```text
Bạn là agent lập trình AI đang làm việc trên: Xây dựng hệ thống AI Agent tổng.

Ngữ cảnh dự án:
- Ý tưởng thô: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tóm tắt: công cụ AI giúp biến ý tưởng "Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tá..." thành kế hoạch và sản phẩm có thể thực thi.
- Người dùng mục tiêu: Người dùng cuối, Người quản lý sản phẩm
- Vấn đề: Người dùng cần một công cụ AI để giải quyết nhu cầu trong ý tưởng: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tổng quan kiến trúc: Kiến trúc công cụ AI tập trung vào hợp đồng input/output, chuỗi prompt, model provider, đánh giá và guardrail. Chế độ sửa repo sẽ ưu tiên stack đang có: Next.js, React.
- Chức năng cốt lõi: Lập kế hoạch thay đổi theo codebase hiện có; Blueprint dự án động theo ngữ cảnh; Cổng duyệt trước các bước có tác động lớn; Nhật ký agent theo thời gian; Schema input/output; Chuỗi prompt; Adapter model provider; Checklist đánh giá

Ngữ cảnh codebase có sẵn:
- Đường dẫn nguồn: /Applications/du-an/AI-agent
- Dấu hiệu framework: Next.js, React
- Ngôn ngữ: TypeScript, TypeScript React
- Trình quản lý gói: npm
- Script: dev, dev:clean, clean, build, build:clean, typecheck, test:integration
- File quan trọng: README.md, app/api/codex/status/route.ts, app/api/projects/[projectId]/analyze/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/approve/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/route.ts, app/api/projects/[projectId]/artifacts/route.ts, app/api/projects/[projectId]/blueprint/route.ts, app/api/projects/[projectId]/codebase/route.ts, app/api/projects/[projectId]/execute/route.ts, app/api/projects/[projectId]/logs/route.ts, app/api/projects/[projectId]/review/route.ts, app/api/projects/[projectId]/route.ts, app/api/projects/route.ts, app/globals.css, app/layout.tsx, app/page.tsx, next.config.ts, package.json, tsconfig.json, workspaces/projects/1b31fa96-9167-43d2-87e7-a16f2a76b177/README.md, workspaces/projects/d6bebdbb-ceb0-430a-8b14-7bb682720c22/README.md

Tác vụ:
- Tiêu đề: Rà soát tác động lên codebase hiện có
- Mục tiêu: Xác định file/module cần sửa trong repo hiện có trước khi thay đổi code.
- Vùng tác động: existing_codebase
- Loại tác vụ: codebase_impact_analysis

Ràng buộc:
- Không giả định mọi dự án đều cần web UI, API, xác thực hoặc database.
- Giữ triển khai khớp với loại dự án đã nhận diện và tiêu chí nghiệm thu của tác vụ.
- Tránh refactor không liên quan và tránh tạo module CRUD cố định nếu blueprint không yêu cầu rõ.
- Giữ cấu trúc dự án, framework, trình quản lý gói và quy ước cục bộ đang có.
- Ưu tiên diff nhỏ trong codebase hiện có và chạy các lệnh kiểm chứng đã phát hiện khi có thể.

Tiêu chí nghiệm thu:
- Chỉ ra file/module liên quan dựa trên ngữ cảnh codebase.
- Giữ trình quản lý gói, framework và script hiện có.
- Nếu cần thêm dependency, phải nêu lý do và rủi ro.

Đầu ra mong đợi:
- Triển khai hoặc cập nhật tập file nhỏ nhất nhưng đủ nhất quán cho tác vụ này.
- Giải thích các file đã đổi và cách kiểm chứng kết quả.
- Nếu yêu cầu còn mơ hồ, nêu giả định trước khi code.
```

## Prompt 2: Hoàn thiện blueprint dự án

```text
Bạn là agent lập trình AI đang làm việc trên: Xây dựng hệ thống AI Agent tổng.

Ngữ cảnh dự án:
- Ý tưởng thô: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tóm tắt: công cụ AI giúp biến ý tưởng "Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tá..." thành kế hoạch và sản phẩm có thể thực thi.
- Người dùng mục tiêu: Người dùng cuối, Người quản lý sản phẩm
- Vấn đề: Người dùng cần một công cụ AI để giải quyết nhu cầu trong ý tưởng: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tổng quan kiến trúc: Kiến trúc công cụ AI tập trung vào hợp đồng input/output, chuỗi prompt, model provider, đánh giá và guardrail. Chế độ sửa repo sẽ ưu tiên stack đang có: Next.js, React.
- Chức năng cốt lõi: Lập kế hoạch thay đổi theo codebase hiện có; Blueprint dự án động theo ngữ cảnh; Cổng duyệt trước các bước có tác động lớn; Nhật ký agent theo thời gian; Schema input/output; Chuỗi prompt; Adapter model provider; Checklist đánh giá

Ngữ cảnh codebase có sẵn:
- Đường dẫn nguồn: /Applications/du-an/AI-agent
- Dấu hiệu framework: Next.js, React
- Ngôn ngữ: TypeScript, TypeScript React
- Trình quản lý gói: npm
- Script: dev, dev:clean, clean, build, build:clean, typecheck, test:integration
- File quan trọng: README.md, app/api/codex/status/route.ts, app/api/projects/[projectId]/analyze/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/approve/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/route.ts, app/api/projects/[projectId]/artifacts/route.ts, app/api/projects/[projectId]/blueprint/route.ts, app/api/projects/[projectId]/codebase/route.ts, app/api/projects/[projectId]/execute/route.ts, app/api/projects/[projectId]/logs/route.ts, app/api/projects/[projectId]/review/route.ts, app/api/projects/[projectId]/route.ts, app/api/projects/route.ts, app/globals.css, app/layout.tsx, app/page.tsx, next.config.ts, package.json, tsconfig.json, workspaces/projects/1b31fa96-9167-43d2-87e7-a16f2a76b177/README.md, workspaces/projects/d6bebdbb-ceb0-430a-8b14-7bb682720c22/README.md

Tác vụ:
- Tiêu đề: Hoàn thiện blueprint dự án
- Mục tiêu: Tổng hợp ý định, yêu cầu và chức năng thành blueprint cho công cụ AI.
- Vùng tác động: planning
- Loại tác vụ: blueprint_design

Ràng buộc:
- Không giả định mọi dự án đều cần web UI, API, xác thực hoặc database.
- Giữ triển khai khớp với loại dự án đã nhận diện và tiêu chí nghiệm thu của tác vụ.
- Tránh refactor không liên quan và tránh tạo module CRUD cố định nếu blueprint không yêu cầu rõ.
- Giữ cấu trúc dự án, framework, trình quản lý gói và quy ước cục bộ đang có.
- Ưu tiên diff nhỏ trong codebase hiện có và chạy các lệnh kiểm chứng đã phát hiện khi có thể.

Tiêu chí nghiệm thu:
- Blueprint có project_type, target_users, problem, goals, constraints.
- Chức năng đề xuất phù hợp với loại dự án.
- Nếu thiếu thông tin, missing questions không quá 3 câu.

Đầu ra mong đợi:
- Triển khai hoặc cập nhật tập file nhỏ nhất nhưng đủ nhất quán cho tác vụ này.
- Giải thích các file đã đổi và cách kiểm chứng kết quả.
- Nếu yêu cầu còn mơ hồ, nêu giả định trước khi code.
```

## Prompt 3: Chuẩn bị hợp đồng thực thi

```text
Bạn là agent lập trình AI đang làm việc trên: Xây dựng hệ thống AI Agent tổng.

Ngữ cảnh dự án:
- Ý tưởng thô: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tóm tắt: công cụ AI giúp biến ý tưởng "Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tá..." thành kế hoạch và sản phẩm có thể thực thi.
- Người dùng mục tiêu: Người dùng cuối, Người quản lý sản phẩm
- Vấn đề: Người dùng cần một công cụ AI để giải quyết nhu cầu trong ý tưởng: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tổng quan kiến trúc: Kiến trúc công cụ AI tập trung vào hợp đồng input/output, chuỗi prompt, model provider, đánh giá và guardrail. Chế độ sửa repo sẽ ưu tiên stack đang có: Next.js, React.
- Chức năng cốt lõi: Lập kế hoạch thay đổi theo codebase hiện có; Blueprint dự án động theo ngữ cảnh; Cổng duyệt trước các bước có tác động lớn; Nhật ký agent theo thời gian; Schema input/output; Chuỗi prompt; Adapter model provider; Checklist đánh giá

Ngữ cảnh codebase có sẵn:
- Đường dẫn nguồn: /Applications/du-an/AI-agent
- Dấu hiệu framework: Next.js, React
- Ngôn ngữ: TypeScript, TypeScript React
- Trình quản lý gói: npm
- Script: dev, dev:clean, clean, build, build:clean, typecheck, test:integration
- File quan trọng: README.md, app/api/codex/status/route.ts, app/api/projects/[projectId]/analyze/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/approve/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/route.ts, app/api/projects/[projectId]/artifacts/route.ts, app/api/projects/[projectId]/blueprint/route.ts, app/api/projects/[projectId]/codebase/route.ts, app/api/projects/[projectId]/execute/route.ts, app/api/projects/[projectId]/logs/route.ts, app/api/projects/[projectId]/review/route.ts, app/api/projects/[projectId]/route.ts, app/api/projects/route.ts, app/globals.css, app/layout.tsx, app/page.tsx, next.config.ts, package.json, tsconfig.json, workspaces/projects/1b31fa96-9167-43d2-87e7-a16f2a76b177/README.md, workspaces/projects/d6bebdbb-ceb0-430a-8b14-7bb682720c22/README.md

Tác vụ:
- Tiêu đề: Chuẩn bị hợp đồng thực thi
- Mục tiêu: Định nghĩa format prompt, output và checklist đánh giá cho agent lập trình.
- Vùng tác động: agent_orchestration
- Loại tác vụ: prompt_contract

Ràng buộc:
- Không giả định mọi dự án đều cần web UI, API, xác thực hoặc database.
- Giữ triển khai khớp với loại dự án đã nhận diện và tiêu chí nghiệm thu của tác vụ.
- Tránh refactor không liên quan và tránh tạo module CRUD cố định nếu blueprint không yêu cầu rõ.
- Giữ cấu trúc dự án, framework, trình quản lý gói và quy ước cục bộ đang có.
- Ưu tiên diff nhỏ trong codebase hiện có và chạy các lệnh kiểm chứng đã phát hiện khi có thể.

Tiêu chí nghiệm thu:
- Mỗi tác vụ có mục tiêu, ràng buộc và tiêu chí nghiệm thu.
- Prompt không yêu cầu API/database nếu kiến trúc không khuyến nghị.
- Checklist đánh giá gắn với loại tác vụ.

Đầu ra mong đợi:
- Triển khai hoặc cập nhật tập file nhỏ nhất nhưng đủ nhất quán cho tác vụ này.
- Giải thích các file đã đổi và cách kiểm chứng kết quả.
- Nếu yêu cầu còn mơ hồ, nêu giả định trước khi code.
```

## Prompt 4: Thiết kế luồng input-output và đánh giá AI

```text
Bạn là agent lập trình AI đang làm việc trên: Xây dựng hệ thống AI Agent tổng.

Ngữ cảnh dự án:
- Ý tưởng thô: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tóm tắt: công cụ AI giúp biến ý tưởng "Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tá..." thành kế hoạch và sản phẩm có thể thực thi.
- Người dùng mục tiêu: Người dùng cuối, Người quản lý sản phẩm
- Vấn đề: Người dùng cần một công cụ AI để giải quyết nhu cầu trong ý tưởng: Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá.
- Tổng quan kiến trúc: Kiến trúc công cụ AI tập trung vào hợp đồng input/output, chuỗi prompt, model provider, đánh giá và guardrail. Chế độ sửa repo sẽ ưu tiên stack đang có: Next.js, React.
- Chức năng cốt lõi: Lập kế hoạch thay đổi theo codebase hiện có; Blueprint dự án động theo ngữ cảnh; Cổng duyệt trước các bước có tác động lớn; Nhật ký agent theo thời gian; Schema input/output; Chuỗi prompt; Adapter model provider; Checklist đánh giá

Ngữ cảnh codebase có sẵn:
- Đường dẫn nguồn: /Applications/du-an/AI-agent
- Dấu hiệu framework: Next.js, React
- Ngôn ngữ: TypeScript, TypeScript React
- Trình quản lý gói: npm
- Script: dev, dev:clean, clean, build, build:clean, typecheck, test:integration
- File quan trọng: README.md, app/api/codex/status/route.ts, app/api/projects/[projectId]/analyze/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/approve/route.ts, app/api/projects/[projectId]/artifacts/[artifactId]/route.ts, app/api/projects/[projectId]/artifacts/route.ts, app/api/projects/[projectId]/blueprint/route.ts, app/api/projects/[projectId]/codebase/route.ts, app/api/projects/[projectId]/execute/route.ts, app/api/projects/[projectId]/logs/route.ts, app/api/projects/[projectId]/review/route.ts, app/api/projects/[projectId]/route.ts, app/api/projects/route.ts, app/globals.css, app/layout.tsx, app/page.tsx, next.config.ts, package.json, tsconfig.json, workspaces/projects/1b31fa96-9167-43d2-87e7-a16f2a76b177/README.md, workspaces/projects/d6bebdbb-ceb0-430a-8b14-7bb682720c22/README.md

Tác vụ:
- Tiêu đề: Thiết kế luồng input-output và đánh giá AI
- Mục tiêu: Định nghĩa schema input/output, chuỗi prompt và checklist đánh giá.
- Vùng tác động: ai_runtime
- Loại tác vụ: write_prompt_chain

Ràng buộc:
- Không giả định mọi dự án đều cần web UI, API, xác thực hoặc database.
- Giữ triển khai khớp với loại dự án đã nhận diện và tiêu chí nghiệm thu của tác vụ.
- Tránh refactor không liên quan và tránh tạo module CRUD cố định nếu blueprint không yêu cầu rõ.
- Giữ cấu trúc dự án, framework, trình quản lý gói và quy ước cục bộ đang có.
- Ưu tiên diff nhỏ trong codebase hiện có và chạy các lệnh kiểm chứng đã phát hiện khi có thể.

Tiêu chí nghiệm thu:
- Kết quả phải phục vụ: công cụ AI giúp biến ý tưởng "Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tá..." thành kế hoạch và sản phẩm có thể thực thi.
- Giữ phạm vi theo blueprint và tài liệu đã duyệt.
- Có chuỗi prompt, kiểm tra schema và rubric đánh giá.

Đầu ra mong đợi:
- Triển khai hoặc cập nhật tập file nhỏ nhất nhưng đủ nhất quán cho tác vụ này.
- Giải thích các file đã đổi và cách kiểm chứng kết quả.
- Nếu yêu cầu còn mơ hồ, nêu giả định trước khi code.
```