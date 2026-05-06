# AI Agent Task Architect

Extension này là đường dùng chính của dự án: người dùng nhập prompt, AI phân tích yêu cầu và chia thành cây nhiệm vụ nhiều tầng để có thể giao từng phần rất nhỏ cho các model AI yếu hơn.

Extension không tự sửa code, không mở terminal và không chạy lệnh trong máy.

## Chạy extension khi phát triển

Mở repo bằng VS Code, sau đó dùng cấu hình debug:

```txt
Run and Debug -> Chạy AI Agent VS Code Extension
```

Hoặc mở extension development host:

```bash
npm run extension:dev
```

## Luồng sử dụng

1. Mở folder dự án trong VS Code.
2. Bấm biểu tượng `AI Agent` trên Activity Bar.
3. Nhập prompt cần phân tích.
4. Chọn độ chi tiết: tự động, ngắn, vừa, hoặc rất chi tiết.
5. Bấm `Tạo cây nhiệm vụ`.

Kết quả được lưu tại:

```txt
.ai-agent/task-plans/:timestamp-:title.md
.ai-agent/task-plans/:timestamp-:title.json
```

File Markdown dùng để đọc và giao việc. File JSON dùng cho tooling sau này.

## Cấu hình AI

Extension ưu tiên gọi API nếu có key. Nếu không có key hoặc provider lỗi, extension dùng bộ chia local để vẫn tạo được cây nhiệm vụ.

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

Nếu không muốn lưu key trong settings, có thể để trống và dùng biến môi trường:

```txt
AI_AGENT_CODEX_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

## Lệnh có sẵn

- `AI Agent: Mở Studio`
- `AI Agent: Tạo Cây Nhiệm Vụ`
- `AI Agent: Mở Kế Hoạch Gần Nhất`

## Đầu ra

Mỗi node trong cây nhiệm vụ có:

- `title`: tên nhiệm vụ
- `objective`: mục tiêu rõ ràng
- `prompt`: prompt riêng để giao cho model yếu
- `acceptance`: tiêu chí nghiệm thu
- `children`: nhiệm vụ con

Độ chi tiết `deep` nhắm tới cấu trúc kiểu công ty: khoảng 5 nhóm lớn, mỗi nhóm tối đa 10 mục con, mỗi mục con tối đa 3-4 nhiệm vụ rất nhỏ. Chế độ `auto` sẽ giảm hoặc tăng số node theo độ dài prompt.
