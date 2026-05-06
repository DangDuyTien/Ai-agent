# PromptFlow Agent - Kiến trúc và kế hoạch triển khai

## 1. Kiến trúc tổng quan

PromptFlow Agent gồm 3 lớp chính:

1. Frontend React: quản lý project, request, hiển thị AI analysis, master prompt, task tree, prompt riêng và export.
2. Backend API: xử lý auth, lưu database, gọi Gemini API, sinh master prompt, chia task, lưu version/export.
3. AI Provider Layer: adapter cho Gemini trước, có thể mở rộng OpenAI, Claude, DeepSeek sau.

Luồng bảo mật bắt buộc:

- React không gọi Gemini trực tiếp.
- `GEMINI_API_KEY` chỉ nằm trong backend `.env`.
- Frontend chỉ gọi `/api/requests/:id/analyze` qua Axios.
- Provider response phải được parse/validate JSON trước khi lưu.

Backend đề xuất: Node.js Express + PostgreSQL.

## 2. Sơ đồ luồng hoạt động

```text
User
  -> React Dashboard tạo Project
  -> Nếu là project có sẵn: lưu local path/repo URL và scan context
  -> React Create Request nhập yêu cầu ngắn
  -> POST /api/projects/:id/requests
  -> POST /api/requests/:id/analyze
  -> Backend GeminiService gọi Gemini
  -> Backend lưu ai_analyses
  -> POST /api/requests/:id/generate-master-prompt
  -> Backend lưu master_prompts + prompt_versions
  -> POST /api/requests/:id/split-tasks
  -> Backend lưu prompt_tasks + task_prompts
  -> React hiển thị Analysis, Master Prompt, Task Tree, Task Prompt Panel
  -> User copy/export JSON/Markdown/TXT
```

## 3. Danh sách chức năng chi tiết

- Quản lý Project: tạo, sửa, xoá, xem trạng thái, công nghệ, context và cấu trúc thư mục.
- Tạo Request: mặc định chỉ nhập prompt ngắn; task type/model strength/split level là tuỳ chọn nâng cao, `auto` để AI tự suy luận.
- AI Analysis: gọi backend Gemini, nhận JSON có cấu trúc, hiển thị loading/error/regenerate.
- Master Prompt: sinh prompt tổng, chỉnh sửa thủ công, copy, lưu version.
- Task Tree: level 1 goal, level 2 module, level 3 task, level 4 prompt thực thi.
- Task Prompt: click task để xem prompt riêng, copy/export từng task.
- Task Runner: Run/Stop từng prompt nhỏ qua local runner ở `127.0.0.1:8787`, mở macOS Terminal và chạy Codex CLI trong đúng workspace.
- Split More: tách tiếp task hard/critical thành prompt nhỏ hơn.
- Export: JSON, Markdown, TXT cho toàn bộ request hoặc từng task.
- History: lưu analysis, master prompt, prompt versions, task status.

## 4. Database schema

### users

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| name | varchar | Tên user |
| email | varchar unique | Email đăng nhập |
| password_hash | varchar nullable | Nếu dùng credentials |
| provider | varchar nullable | google/github nếu có social login |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### projects

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| user_id | FK users.id | Chủ project |
| name | varchar | Tên project |
| description | text | Mô tả |
| technologies | json | React, Laravel, MySQL... |
| status | enum | active/planning/paused/archived |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### project_contexts

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| project_id | FK projects.id |  |
| overview | text | Context dự án |
| folder_structure | text nullable | Cấu trúc thư mục |
| architecture_notes | text nullable | Pattern/ràng buộc |
| constraints | json nullable | Điều không được phá |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### ai_requests

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| project_id | FK projects.id |  |
| user_id | FK users.id |  |
| original_prompt | text | Yêu cầu gốc |
| task_type | enum | feature/bugfix/ui/refactor/optimization/document/analysis |
| model_strength | enum | weak/medium/strong |
| split_level | enum | normal/detailed/very_detailed |
| status | enum | draft/analyzing/analyzed/prompted/split/failed |
| error_message | text nullable | Lỗi gần nhất |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### ai_analyses

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| ai_request_id | FK ai_requests.id |  |
| provider | varchar | gemini |
| model | varchar | gemini-... |
| summary | text |  |
| task_type | enum |  |
| main_goal | text |  |
| scope | json | array string |
| requirements | json | array string |
| risks | json | array string |
| related_modules | json | array string |
| output_expectation | text |  |
| raw_response | json | Provider response |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### master_prompts

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| ai_request_id | FK ai_requests.id |  |
| content | longtext | Prompt tổng |
| version | int | Version hiện tại |
| validation_issues | json nullable | Cảnh báo prompt |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### prompt_tasks

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| ai_request_id | FK ai_requests.id |  |
| parent_id | FK prompt_tasks.id nullable | Cây task |
| task_id | varchar | 1, 1.1, 2.1.prompt |
| title | varchar |  |
| description | text |  |
| level | int | 1-4 |
| kind | enum | goal/module/task/prompt |
| difficulty | enum | easy/medium/hard/critical |
| status | enum | pending/ready/running/done/failed |
| depends_on | json | Danh sách task_id |
| related_modules | json |  |
| warnings | json nullable |  |
| acceptance_criteria | json nullable |  |
| sort_order | decimal | Thứ tự chạy |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### task_prompts

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| prompt_task_id | FK prompt_tasks.id |  |
| content | longtext | Prompt riêng |
| max_words | int nullable | Giới hạn theo model |
| validation_issues | json nullable |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### prompt_versions

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| ai_request_id | FK ai_requests.id |  |
| master_prompt_id | FK master_prompts.id nullable |  |
| task_prompt_id | FK task_prompts.id nullable |  |
| version | int |  |
| content | longtext | Snapshot |
| note | varchar nullable |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### exports

| Field | Type | Ghi chú |
| --- | --- | --- |
| id | uuid/bigint | PK |
| ai_request_id | FK ai_requests.id |  |
| user_id | FK users.id |  |
| format | enum | json/markdown/txt |
| payload | json | Nội dung export |
| file_path | varchar nullable | Nếu lưu file |
| created_at | timestamp |  |
| updated_at | timestamp |  |

## 5. API routes

```text
POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
POST   /api/projects/:id/scan-context
DELETE /api/projects/:id

POST   /api/projects/:id/requests
POST   /api/requests/:id/analyze
POST   /api/requests/:id/generate-master-prompt
POST   /api/requests/:id/split-tasks
POST   /api/tasks/:id/generate-prompt
POST   /api/tasks/:id/split-more

GET    /api/projects/:id/tasks
GET    /api/requests/:id/prompts
POST   /api/exports
```

Local runner:

```text
GET    http://127.0.0.1:8787/health
POST   http://127.0.0.1:8787/run
GET    http://127.0.0.1:8787/status/:executionId
POST   http://127.0.0.1:8787/stop/:executionId
```

## 6. Cấu trúc thư mục React

```text
src/
  api/
  components/
    common/
    projects/
    prompts/
    requests/
    tasks/
  pages/
  store/
  types/
  utils/
  App.tsx
  main.tsx
```

## 7. Logic gọi Gemini API

Backend service nên có interface:

```ts
interface AiProvider {
  analyzePrompt(input: AnalyzePromptInput): Promise<AiAnalysisJson>;
}
```

Gemini request payload:

```json
{
  "original_prompt": "Thêm chức năng đăng nhập bằng Google",
  "project_context": "Context dự án...",
  "technologies": ["React", "Node.js", "PostgreSQL"],
  "task_type": "feature",
  "target_goal": "Sinh analysis JSON cho AI coding prompt"
}
```

Quy trình backend:

1. Load request + project + project_context.
2. Tạo system prompt bắt Gemini chỉ trả JSON hợp lệ.
3. Gọi Gemini với timeout/retry hợp lý.
4. Strip markdown fence nếu provider trả ```json.
5. Parse JSON.
6. Validate đủ field bắt buộc.
7. Lưu `ai_analyses`.
8. Trả JSON cho React.

## 8. Logic sinh prompt tổng

Input:

- Project context.
- Original prompt.
- Gemini analysis.
- Target model strength.
- Split level.

Output:

- Master prompt có bối cảnh, mục tiêu, scope, yêu cầu chi tiết, UI/API/database/validation/auth/error handling, tiêu chí hoàn thành, điều không được phá.

Rule:

- Không đưa secret vào prompt.
- Nếu model yếu, master prompt chỉ là tài liệu tổng, không đưa trực tiếp để code một lần.
- Luôn thêm mục "Không được phá vỡ".

## 9. Logic chia prompt đa cấp

Input:

- Yêu cầu gốc.
- Gemini analysis.
- Model strength.
- Split level.

Output:

- `PromptTask` tree.
- `orderedPrompts` đã sắp theo phụ thuộc.

Rule:

- Database trước backend.
- Backend trước frontend nếu UI cần API/data flow.
- UI sau khi có contract.
- Test và tài liệu cuối.
- Không gom nhiều chức năng vào một prompt.
- Task hard/critical phải split tiếp nếu model target là weak.
- Critical task phải có cảnh báo review thủ công.

Pseudo:

```ts
function splitPrompt(input) {
  modules = [Scope]
  if needsDatabase(input.analysis) modules.push(Database)
  if needsBackend(input.analysis) modules.push(BackendAPI)
  if needsFrontend(input.analysis) modules.push(FrontendUI)
  modules.push(TestAndDocs)

  for each module:
    create level 2 module node
    for each task template:
      estimate difficulty
      if task too broad and targetModel === "weak":
        split into prepare + implement
      create level 3 task
      create level 4 execution prompt
      attach depends_on
  return tree + topological ordered prompts
}
```

## 10. Format JSON output chuẩn

```json
{
  "analysis": {
    "summary": "Tóm tắt yêu cầu",
    "task_type": "feature",
    "main_goal": "Mục tiêu chính",
    "scope": ["Phạm vi 1"],
    "requirements": ["Yêu cầu 1"],
    "risks": ["Rủi ro 1"],
    "related_modules": ["auth", "ui"],
    "output_expectation": "Kết quả cần đạt"
  },
  "master_prompt": {
    "content": "Prompt tổng...",
    "version": 1,
    "validation_issues": []
  },
  "task_tree": {
    "task_id": "G",
    "level": 1,
    "kind": "goal",
    "title": "Project Goal",
    "children": []
  },
  "ordered_prompts": [
    {
      "task_id": "2.1",
      "title": "Tạo API thêm sản phẩm vào giỏ hàng",
      "level": 3,
      "difficulty": "medium",
      "depends_on": ["1.1"],
      "status": "ready",
      "prompt": "Bạn là AI coding assistant..."
    }
  ],
  "warnings": ["Critical task cần review"],
  "verification_criteria": ["Chạy test liên quan"]
}
```

## 11. Giao diện cần xây

- Dashboard Project: danh sách, tạo, sửa, xoá, trạng thái.
- Project Detail: thông tin, context, folder structure, request history.
- Project Form Local Source: người dùng chọn thư mục bằng browser file picker; frontend lấy `webkitRelativePath` để tạo snapshot cấu trúc thư mục. Browser không expose absolute path.
- Project Detail Scan Context: backend/local agent đọc codebase có sẵn từ snapshot/local source/repo URL và cập nhật project_contexts.
- Create Request: prompt input là chính; task type, model strength, split level nằm trong Advanced.
- Project Detail Quick Request: nhập một câu trong project có sẵn để AI tự phân tích và sinh prompt/task tree ngay.
- AI Analysis Panel: JSON analysis, regenerate, loading/error.
- Master Prompt Panel: textarea chỉnh prompt, copy, save version.
- Task Tree View: cây 4 level, difficulty/status badges, split more.
- Task Prompt Detail: panel phải, copy/export từng prompt.
- Task Run Controls: nút Run Codex, Stop, trạng thái local runner, bước hiện tại, workspace và command đang chạy.
- Export Page: export JSON/Markdown/TXT.

## 12. Lộ trình code theo giai đoạn

1. Frontend shell: Vite, Tailwind, routing, Zustand, Axios.
2. Project CRUD local/API-ready.
3. Request form và local/mock generation.
4. Analysis panel + master prompt panel.
5. Task tree + task prompt panel.
6. Export JSON/Markdown/TXT.
7. Backend Express + PostgreSQL schema.
8. GeminiService + JSON validator.
9. Persist history/version/export.
10. Auth + rate limit + audit log.
11. Test unit/integration/E2E.

## 13. Prompt mẫu hệ thống dùng bên trong Agent

```text
Bạn là Senior AI Product Architect.
Nhiệm vụ: phân tích yêu cầu phần mềm ngắn của người dùng và trả về JSON hợp lệ.

Chỉ trả về JSON, không markdown, không giải thích ngoài JSON.

Input gồm:
- original_prompt
- project_context
- technologies
- task_type
- target_goal

JSON schema:
{
  "summary": "string",
  "task_type": "feature | bugfix | ui | refactor | optimization | document | analysis",
  "main_goal": "string",
  "scope": ["string"],
  "requirements": ["string"],
  "risks": ["string"],
  "related_modules": ["string"],
  "output_expectation": "string"
}

Quy tắc:
- Nếu yêu cầu thiếu chi tiết, suy luận hợp lý.
- Không hỏi lại trừ khi không thể suy luận an toàn.
- Luôn nêu rủi ro phá code cũ, database, auth, performance nếu có.
- Related modules viết ngắn dạng slug: auth, cart, product, admin, api, database, ui.
```

Prompt task nhỏ:

```text
Bạn là AI coding assistant.
Chỉ thực hiện task sau:

Task:
[Mô tả task]

Bối cảnh:
[Context ngắn]

File/Module liên quan:
[Danh sách file/module]

Yêu cầu cần làm:
- ...

Không được làm:
- Không sửa chức năng ngoài phạm vi
- Không xoá code cũ nếu không cần
- Không đổi cấu trúc project nếu không được yêu cầu
- Không tự ý thêm thư viện nặng

Kết quả mong muốn:
- ...

Sau khi làm xong:
- Liệt kê file đã sửa
- Giải thích ngắn gọn đã làm gì
- Nêu cách test
```

## 14. Rủi ro kỹ thuật

- Gemini trả JSON lỗi format: cần JSON repair nhẹ hoặc retry với prompt sửa lỗi.
- Prompt quá dài: cần word/token budget theo model strength.
- Split task sai phụ thuộc: cần topological validation.
- User context thiếu: agent có thể chọn sai module.
- Critical task auth/payment/database: cần cảnh báo review thủ công.
- Không có backend: frontend chỉ mock được, không nên dùng Gemini key ở browser.
- Export lớn: cần giới hạn payload hoặc lưu file server-side.

## 15. Cách test toàn bộ hệ thống

Frontend:

- `npm run typecheck`
- `npm run build`
- Tạo project mới.
- Sửa/xoá project.
- Tạo request với từng task type.
- Kiểm tra loading/error/empty state.
- Generate analysis, master prompt, split tasks.
- Click task tree, copy prompt, export JSON/Markdown/TXT.
- Split more task hard/critical.
- Refresh browser và kiểm tra localStorage vẫn giữ dữ liệu.

Backend:

- Unit test GeminiService parse JSON.
- Integration test API project/request/analyze/generate/split/export.
- Test missing/invalid `GEMINI_API_KEY`.
- Test provider timeout/retry.
- Test auth: user không truy cập project của user khác.
- Test database constraints và cascade behavior.

E2E:

- Tạo project -> tạo request "Tạo chức năng giỏ hàng" -> analysis -> master prompt -> split tasks -> export Markdown.
- Tạo request critical "Đăng nhập Google" -> kiểm tra cảnh báo auth/security và task difficulty.
