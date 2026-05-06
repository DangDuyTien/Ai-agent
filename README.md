# AI Agent Task Architect

Đường dùng chính của dự án là VS Code extension theo mô hình planner-only: người dùng nhập prompt, AI phân tích và chia thành cây nhiệm vụ nhiều tầng. Hệ thống không tự code, không mở terminal và không chạy lệnh trong máy.

Mục tiêu là tạo các prompt nhỏ, rõ, có tiêu chí nghiệm thu để giao từng phần cho model AI yếu hơn.

## Chạy VS Code Extension

Mở repo trong VS Code rồi chạy debug config:

```txt
Run and Debug -> Chạy AI Agent VS Code Extension
```

Hoặc mở extension development host:

```bash
npm run extension:dev
```

Trong VS Code, bấm biểu tượng `AI Agent` ở Activity Bar:

1. Nhập prompt hoặc ý tưởng cần phân tích.
2. Chọn độ chi tiết: tự động, ngắn, vừa, hoặc rất chi tiết.
3. Bấm `Tạo cây nhiệm vụ`.

Kết quả được lưu tại:

```txt
.ai-agent/task-plans/:timestamp-:title.md
.ai-agent/task-plans/:timestamp-:title.json
```

## Cây nhiệm vụ

```txt
Nhóm lớn
  -> Mục con
    -> Nhiệm vụ rất nhỏ
```

Chế độ `deep` nhắm tới cấu trúc rất chi tiết: khoảng 5 nhóm lớn, mỗi nhóm tối đa 10 mục con, mỗi mục con tối đa 3-4 nhiệm vụ rất nhỏ. Chế độ `auto` tự giảm hoặc tăng số node theo độ dài prompt.

Mỗi node có:

- `title`: tên nhiệm vụ
- `objective`: mục tiêu cụ thể
- `prompt`: prompt riêng để giao cho model yếu
- `acceptance`: tiêu chí nghiệm thu
- `children`: nhiệm vụ con

## Cấu hình AI

Extension ưu tiên API nếu có key. Nếu chưa cấu hình key hoặc provider lỗi, extension dùng bộ chia local để vẫn tạo được kế hoạch.

Trong VS Code settings:

```json
{
  "aiAgent.provider": "auto",
  "aiAgent.openaiApiKey": "",
  "aiAgent.openaiModel": "gpt-5.4-mini",
  "aiAgent.geminiApiKey": "",
  "aiAgent.geminiModel": "gemini-2.5-flash"
}
```

Có thể để trống key trong settings và dùng biến môi trường:

```txt
AI_AGENT_CODEX_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

## Lệnh

```bash
npm run extension:check
npm run typecheck
npm run test:integration
npm run build
```

## Tài liệu

- `extensions/vscode/README.md`: cách dùng extension.
- `docs/architecture.md`: kiến trúc Task Architect.
- `docs/vscode-extension.md`: quyết định chuyển sang planner-only.

## Legacy Web Dashboard

Next dashboard/API cũ vẫn còn trong repo để tham chiếu pipeline trước đây và giữ test tích hợp. Luồng chính mới là VS Code extension trong `extensions/vscode`.

Chạy web dashboard legacy khi cần:

```bash
npm run dev:clean
```

Mặc định mở tại `http://localhost:3100`.
