# AI Agent Studio VS Code Extension

Extension này là đường dùng chính cho dự án: chạy AI agent ngay trong VS Code, thao tác trực tiếp trên workspace và dùng Terminal tích hợp của máy Mac.

## Chạy extension khi phát triển

Mở repo bằng VS Code, sau đó dùng cấu hình debug:

```txt
Run and Debug -> Chạy AI Agent VS Code Extension
```

Hoặc chạy từ terminal:

```bash
code --extensionDevelopmentPath=extensions/vscode .
```

## Luồng sử dụng

1. Mở folder dự án cần sửa trong VS Code.
2. Bấm biểu tượng `AI Agent` trên Activity Bar.
3. Nhập yêu cầu, chọn chế độ.
4. Bấm `Chạy Codex trong Terminal`.

Extension sẽ tạo prompt tại:

```txt
.ai-agent/prompts/:timestamp-:mode.md
```

Sau đó extension mở `AI Agent Terminal`, ưu tiên chạy:

```bash
codex exec --cd <workspace> --model <model> <prompt>
```

Nếu Codex lỗi, hết token/quota hoặc không có kết nối, runner sẽ fallback sang Gemini CLI nếu `aiAgent.autoFallbackGemini` đang bật.

## Cấu hình

Trong VS Code settings:

```json
{
  "aiAgent.codexCommand": "codex",
  "aiAgent.codexModel": "gpt-5.5",
  "aiAgent.geminiCommand": "gemini",
  "aiAgent.autoFallbackGemini": true
}
```

## Lệnh có sẵn

- `AI Agent: Mở Studio`
- `AI Agent: Chạy Codex Cho Workspace`
- `AI Agent: Rà Soát Workspace`
- `AI Agent: Dừng Terminal Agent`

## Ghi chú

- Extension không cần Next server.
- Web dashboard cũ chỉ còn là chế độ phụ để xem lại pipeline/API nếu cần.
- Agent thao tác trong workspace đang mở; không chạy ngoài folder nếu prompt không yêu cầu rõ.
