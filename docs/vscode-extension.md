# Chuyển hướng sang VS Code Extension

## Quyết định

Web dashboard không còn là đường dùng chính. Dự án chuyển trọng tâm sang VS Code extension để AI agent thao tác trực tiếp trên workspace và terminal của máy Mac.

## Kiến trúc mới

```txt
VS Code Activity Bar
  -> AI Agent Studio Webview
  -> tạo prompt trong .ai-agent/prompts
  -> mở VS Code Integrated Terminal
  -> chạy resources/agent-runner.sh
  -> ưu tiên Codex CLI
  -> fallback Gemini CLI nếu Codex lỗi và bật cấu hình fallback
```

## Vì sao cách này hợp lý hơn

- Không phải upload repo qua web.
- Không cần nhập path `/Applications/...` thủ công.
- AI nhìn và sửa đúng workspace đang mở.
- Lệnh kiểm tra chạy trong terminal thật của dự án.
- Dễ dừng terminal agent ngay trong VS Code.

## Phạm vi bản đầu

- Sidebar extension nhận yêu cầu và chế độ chạy.
- Lưu prompt thành file để người dùng xem/sửa được.
- Chạy Codex bằng terminal tích hợp.
- Fallback Gemini qua CLI nếu Codex lỗi.
- Có lệnh review workspace và chạy test/typecheck/build nếu repo có script.

## Phần web còn giữ lại

Next dashboard/API vẫn ở repo để tham chiếu pipeline cũ và có thể dùng khi cần xem blueprint. Tuy nhiên workflow khuyến nghị là dùng extension trong `extensions/vscode`.
