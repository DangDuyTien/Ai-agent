# Kiến trúc Task Architect

## Mục tiêu

Dự án hiện ưu tiên mô hình planner-only. Người dùng nhập prompt, hệ thống dùng AI hoặc bộ chia local để phân tích và tạo cây nhiệm vụ nhiều tầng. Đầu ra phục vụ việc giao từng prompt nhỏ cho model AI yếu hơn.

Hệ thống không tự sửa code, không mở terminal và không chạy lệnh máy. Phạm vi chính là phân tích, chia nhỏ, lưu kế hoạch và giúp người dùng kiểm soát thứ tự triển khai.

## Luồng chính

```txt
Prompt người dùng
  -> xác định độ chi tiết
  -> tóm tắt workspace đang mở
  -> gọi OpenAI/Codex API hoặc Gemini API nếu có key
  -> fallback bộ chia local nếu provider lỗi hoặc chưa có key
  -> chuẩn hóa cây nhiệm vụ
  -> lưu Markdown + JSON trong .ai-agent/task-plans
```

## Cây nhiệm vụ

```txt
Nhóm lớn
  -> Mục con
    -> Nhiệm vụ rất nhỏ
```

Mỗi node có:

- `title`: tên nhiệm vụ
- `objective`: mục tiêu cụ thể
- `prompt`: prompt riêng để giao cho model yếu
- `acceptance`: tiêu chí nghiệm thu
- `children`: danh sách nhiệm vụ con

Chế độ `deep` nhắm tới khoảng 5 nhóm lớn, mỗi nhóm tối đa 10 mục con, mỗi mục con tối đa 3-4 nhiệm vụ rất nhỏ. Chế độ `auto` tự giảm hoặc tăng số node theo độ dài prompt.

## Provider

- `auto`: ưu tiên OpenAI/Codex API, fallback Gemini API, sau cùng dùng local planner.
- `openai`: chỉ dùng OpenAI/Codex API.
- `gemini`: chỉ dùng Gemini API.
- `local`: không gọi mạng, dùng bộ chia heuristic trong extension.

Extension đọc key từ VS Code settings hoặc biến môi trường:

```txt
AI_AGENT_CODEX_API_KEY
OPENAI_API_KEY
GEMINI_API_KEY
```

## Lưu trữ

Mỗi lần tạo kế hoạch sinh hai file:

```txt
.ai-agent/task-plans/:timestamp-:title.md
.ai-agent/task-plans/:timestamp-:title.json
```

Markdown dành cho người dùng đọc và giao việc. JSON dành cho tooling sau này.

## Phần legacy

Next dashboard/API vẫn còn trong repo để tham chiếu pipeline cũ và giữ test tích hợp hiện có. Đường dùng chính mới là VS Code extension trong `extensions/vscode`.
