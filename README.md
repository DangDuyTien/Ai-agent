# Hệ thống AI Agent tổng quát MVP

MVP này dùng để nhập một ý tưởng dự án thô, cho agent pipeline phân tích theo ngữ cảnh, tạo blueprint, lộ trình, tác vụ, prompt, cổng duyệt, execution bundle và báo cáo đánh giá.

Hệ thống hỗ trợ hai chế độ:

- `new_project`: tạo kế hoạch cho dự án mới từ ý tưởng thô.
- `existing_project`: quét repo có sẵn, tạo `codebase_context`, lập task/prompt theo codebase hiện có, thực thi vào `.ai-agent/runs/:projectId` trong repo và đánh giá bằng script của repo nếu có.

## Chạy local

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
AI_AGENT_LLM_PROVIDER=mock | openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
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
POST /api/projects
POST /api/projects/:projectId/codebase
POST /api/projects/:projectId/analyze
GET  /api/projects/:projectId/blueprint
PATCH /api/projects/:projectId/artifacts/:artifactId
POST /api/projects/:projectId/artifacts/:artifactId/approve
POST /api/projects/:projectId/execute
POST /api/projects/:projectId/review
```
