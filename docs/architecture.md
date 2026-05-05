# Kiến trúc MVP

## Mục tiêu

Hệ thống không cố định vào app web, CRUD hay database. Mỗi ý tưởng được chuyển thành `ProjectBlueprint`, trong đó các tài liệu như `intent_analysis`, `requirements`, `feature_discovery`, `architecture_plan`, `task_plan`, `execution_prompt`, `review_report` đều có phiên bản và trạng thái duyệt.

## Luồng xử lý

```txt
Ý tưởng người dùng
  -> Agent phân tích codebase (tùy chọn, existing_project)
  -> Agent phân tích ý định
  -> Agent xây dựng yêu cầu
  -> Agent khám phá chức năng
  -> Agent lập kiến trúc
  -> Agent chia nhỏ tác vụ
  -> Agent soạn prompt
  -> Người dùng duyệt
  -> Agent thực thi
  -> Agent đánh giá
  -> Prompt sửa lỗi nếu cần
```

## Nguyên tắc agent

- Các agent lập kế hoạch ưu tiên provider AI để tạo `intent_analysis`, `requirements`, `feature_discovery`, `architecture_plan`, `roadmap`, `task_plan` và `execution_prompt` từ ý tưởng/codebase.
- Agent phân tích ý định phân loại project theo tín hiệu, độ tin cậy và câu hỏi còn thiếu.
- Agent phân tích codebase quét repo có sẵn, lấy framework, package manager, script, file chính và rủi ro.
- Agent khám phá chức năng đề xuất chức năng theo `project_type`, không tạo CRUD mặc định.
- Agent lập kiến trúc chỉ đề xuất frontend/backend/API/database khi có lý do rõ ràng.
- Agent chia nhỏ tác vụ ưu tiên Codex/OpenAI API để sinh `roadmap` và `task_plan` từ ý tưởng và tài liệu đã có; nếu không có provider thật thì dùng heuristic động theo project type, feature, kiến trúc và tích hợp.
- Agent soạn prompt tạo prompt có ngữ cảnh, ràng buộc, tiêu chí nghiệm thu và checklist đánh giá.
- Agent thực thi của MVP tạo gói thực thi trong `workspaces/projects/:projectId`.
- Agent thực thi tạo `approvedArtifactSnapshot` từ phiên bản tài liệu mới nhất đã được duyệt trước khi tạo đầu ra.
- Bộ thực thi sửa code gọi provider để lấy danh sách chỉnh sửa file dạng JSON, validate đường dẫn, apply edit, chạy sandbox và lặp fix tối đa `AI_AGENT_MAX_FIX_ITERATIONS`.
- Nếu `AI_AGENT_EXECUTOR=codex`, executor gọi `codex exec --dangerously-bypass-approvals-and-sandbox --cd <workspace>` và dùng auth hiện có của Codex CLI.
- Nếu Codex CLI/API thiếu token, hết quota hoặc lỗi kết nối, provider fallback sang Gemini khi có `GEMINI_API_KEY`.
- Agent đánh giá kiểm tra tài liệu đầu ra, độ lệch snapshot và lệnh sandbox nếu thư mục làm việc có `package.json`.
- Nhật ký lưu cả input gửi tới agent, output AI/provider trả về, trạng thái lỗi/fallback và thời gian chạy để bảng điều khiển hiển thị như một cuộc chat terminal.

## Chế độ dự án có sẵn

Với repo có sẵn:

```txt
POST /api/projects
POST /api/projects/:id/codebase
POST /api/projects/:id/analyze
duyệt codebase_context + các tài liệu lập kế hoạch
POST /api/projects/:id/execute
POST /api/projects/:id/review
```

Agent thực thi ghi tài liệu vào `.ai-agent/runs/:projectId` trong repo. Agent đánh giá chạy trên đường dẫn nguồn của repo để có thể dùng script trong `package.json` như `typecheck`, `test`, `build`.

## Cổng ổn định

- API patch project chỉ cho sửa `name`, `rawIdea` và `sourcePath`.
- Chỉnh sửa tài liệu được validate bằng Zod theo `artifact_type`; tài liệu execution/review không cho sửa qua bảng điều khiển.
- JSON-file store có in-process mutex và atomic rename để giảm lost update trong MVP.
- Integration test bao phủ luồng `analyze -> approve -> execute -> review`, case rerun analysis làm stale approval bị chặn và existing project mode.

## Nâng cấp sau MVP

- Đổi JSON-file storage sang PostgreSQL theo `packages/db/migrations/001_initial.sql`.
- Mở rộng LLM provider adapter cho các agent phân tích còn lại, không chỉ task planner và code edit executor.
- Đưa agent run vào queue worker như BullMQ.
- Thêm Docker sandbox cho execution code thật.
- Thêm websocket/SSE để stream log realtime.
