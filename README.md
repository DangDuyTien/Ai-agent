# AI Agent Studio

Đường dùng chính hiện tại là VS Code extension: nhập yêu cầu trong VS Code, agent tạo prompt trong workspace, chạy Codex trực tiếp bằng Terminal của máy Mac và fallback sang Gemini CLI khi Codex lỗi/hết token/quota.

## Chạy bằng VS Code Extension

Mở repo trong VS Code rồi chạy debug config:

```txt
Run and Debug -> Chạy AI Agent VS Code Extension
```

Hoặc mở extension development host từ terminal:

```bash
npm run extension:dev
```

Trong VS Code, bấm biểu tượng `AI Agent` ở Activity Bar:

1. Nhập yêu cầu hoặc ý tưởng cần AI xử lý.
2. Chọn chế độ: tự code, lập kế hoạch, rà soát, hoặc sửa lỗi.
3. Bấm `Chạy Codex trong Terminal`.

Extension sẽ lưu prompt ở `.ai-agent/prompts`, mở terminal tích hợp của VS Code và chạy `codex exec` trong đúng workspace đang mở. Nếu Codex thất bại và `aiAgent.autoFallbackGemini=true`, runner tự chuyển sang Gemini CLI.

Kiểm tra extension:

```bash
npm run extension:check
```

Tài liệu chi tiết: `extensions/vscode/README.md` và `docs/vscode-extension.md`.

## Web dashboard phụ

MVP này dùng để nhập một ý tưởng dự án thô, cho agent pipeline phân tích theo ngữ cảnh, tạo blueprint, lộ trình, tác vụ, prompt, cổng duyệt, execution bundle và báo cáo đánh giá.

Web dashboard/API vẫn được giữ để tham chiếu pipeline cũ, nhưng không còn là luồng chính khi muốn AI tự thao tác trên codebase.

Hệ thống hỗ trợ hai chế độ:

- `new_project`: tạo kế hoạch cho dự án mới từ ý tưởng thô.
- `existing_project`: quét repo có sẵn, tạo `codebase_context`, lập task/prompt theo codebase hiện có, thực thi vào `.ai-agent/runs/:projectId` trong repo và đánh giá bằng script của repo nếu có.

## Chạy web dashboard local

```bash
npm install
npm run dev
```

Mở dashboard tại `http://localhost:3000`.

Kiểm tra:

```bash
npm run typecheck
npm run test:integration
npm run build
npm audit --omit=dev
```

## Agent pipeline

1. Agent phân tích codebase, nếu là `existing_project`
2. Agent phân tích ý định
3. Agent xây dựng yêu cầu
4. Agent khám phá chức năng
5. Agent lập kiến trúc
6. Agent chia nhỏ tác vụ
7. Agent soạn prompt
8. Agent thực thi
9. Agent đánh giá
10. Agent bộ nhớ/ngữ cảnh

MVP đang dùng bộ chạy heuristic và JSON-file storage trong `data/db.json`. Các hợp đồng agent, tài liệu và tác vụ được type hóa để sau này thay bằng LLM provider, PostgreSQL/JSONB và queue worker mà không phải đổi bảng điều khiển.

## Cấu hình runtime

```txt
AI_AGENT_DB_PATH=/đường/dẫn/db.json
AI_AGENT_WORKSPACE_ROOT=/đường/dẫn/workspaces
AI_AGENT_EXECUTOR=file-edits | codex
AI_AGENT_LLM_PROVIDER=auto | mock
AI_AGENT_CODEX_API_KEY=...   # ưu tiên; có thể dùng CODEX_API_KEY hoặc OPENAI_API_KEY
AI_AGENT_CODEX_API_MODEL=gpt-5.4-mini
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
AI_AGENT_CODEX_COMMAND=codex
AI_AGENT_CODEX_MODEL=gpt-5.5
AI_AGENT_CODEX_PROFILE=...
AI_AGENT_CODEX_EPHEMERAL=true
AI_AGENT_CODEX_TIMEOUT_MS=600000
AI_AGENT_SANDBOX=local | docker
AI_AGENT_DOCKER_IMAGE=node:22-alpine
AI_AGENT_SANDBOX_TIMEOUT_MS=120000
AI_AGENT_MAX_FIX_ITERATIONS=2
AI_AGENT_STATIC_FILE_EDITS='{"summary":"...","edits":[...]}'
```

Thực thi chỉ được chạy khi phiên bản mới nhất của các tài liệu bắt buộc đã được duyệt. Mỗi kết quả thực thi lưu `approvedArtifactSnapshot`; Agent đánh giá sẽ báo lỗi nếu có kế hoạch mới hơn xuất hiện sau lần thực thi.

Với `existing_project`, `codebase_context` cũng là tài liệu bắt buộc phải duyệt. Agent đánh giá sẽ chạy sandbox trên chính đường dẫn nguồn của repo, không phải thư mục bundle.

Khi sửa repo có sẵn, có thể bấm `Chọn thư mục` trong dashboard để upload thư mục dự án vào `AI_AGENT_WORKSPACE_ROOT/uploads`, hoặc `workspaces/uploads` nếu chưa cấu hình biến môi trường. Hệ thống tự điền `sourcePath` của bản copy này để agent quét mã nguồn; các thư mục nặng như `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage` được bỏ qua khi upload.

Bộ chọn provider luôn ưu tiên Codex theo thứ tự: Codex CLI nếu đã đăng nhập, Codex/OpenAI API nếu có key, rồi mới fallback sang Gemini khi Codex thiếu token, hết quota hoặc lỗi kết nối. Nếu không có key thật, hệ thống dùng mock để vẫn tạo được blueprint nhưng không sửa code thật.

Các tài liệu lập kế hoạch chính (`intent_analysis`, `requirements`, `feature_discovery`, `architecture_plan`, `roadmap`, `task_plan`, `execution_prompt`) đều ưu tiên sinh bằng Codex/OpenAI API hoặc Gemini fallback. Khi không có provider thật, hệ thống mới dùng heuristic động theo ý tưởng, loại dự án, feature, kiến trúc và tích hợp; không còn nhân task theo phase cứng cho mọi dự án.

Tab nhật ký hiển thị theo dạng chat terminal: yêu cầu gửi vào agent, output AI/provider trả về, thời điểm log và thời gian agent đang chạy.

Khi tạo `execution_prompt`, hệ thống không yêu cầu AI sinh tất cả prompt trong một lần. Prompt Composer gọi provider theo từng tác vụ nhỏ, sau đó ghép kết quả thành danh sách prompt đã duyệt để giảm quá tải cho model yếu.

Với dự án đang chọn, có thể nhập yêu cầu ở khối `Phát triển tiếp`. Hệ thống sẽ append yêu cầu mới vào bối cảnh dự án, giữ codebase hiện có nếu có, rồi chạy lại phân tích để tạo lộ trình/tác vụ/prompt cho phần phát triển bổ sung.

Bộ thực thi sửa code gọi provider để lấy danh sách chỉnh sửa file dạng JSON:

```json
{
  "summary": "short summary",
  "edits": [
    {
      "path": "relative/path.ts",
      "action": "create | overwrite | replace | append",
      "content": "file content",
      "oldText": "text to replace",
      "newText": "replacement"
    }
  ]
}
```

Đường dẫn edit bắt buộc nằm trong thư mục làm việc và bị chặn nếu đi vào `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage`, `.ai-agent`.

Nếu dùng Codex CLI:

```bash
codex login status
codex logout
codex login
AI_AGENT_EXECUTOR=codex npm run dev
```

Khi hết token hoặc muốn đổi tài khoản, chạy `codex logout` rồi `codex login` trong terminal. Agent sẽ dùng lại credentials mới trong lần execute tiếp theo. Trạng thái CLI có thể kiểm tra qua `GET /api/codex/status`.

## API chính

```txt
POST /api/uploads/codebase
POST /api/projects
POST /api/projects/:projectId/codebase
POST /api/projects/:projectId/analyze
GET  /api/projects/:projectId/blueprint
PATCH /api/projects/:projectId/artifacts/:artifactId
POST /api/projects/:projectId/artifacts/:artifactId/approve
POST /api/projects/:projectId/execute
POST /api/projects/:projectId/review
```
