# VS Code Task Architect

## Quyết định

Dự án chuyển sang mô hình planner-only. Người dùng chỉ nhập prompt; AI phân tích và chia thành cây nhiệm vụ nhiều tầng. Extension không tự code, không chạy terminal và không thao tác file ngoài việc lưu kế hoạch.

## Kiến trúc

```txt
VS Code Activity Bar
  -> AI Agent Task Architect Webview
  -> nhận prompt và độ chi tiết
  -> gọi OpenAI/Codex API hoặc Gemini API nếu có key
  -> fallback bộ chia local nếu không có provider
  -> lưu Markdown + JSON trong .ai-agent/task-plans
```

## Cấu trúc nhiệm vụ

```txt
Nhóm lớn
  -> Mục con
    -> Nhiệm vụ rất nhỏ
```

Với yêu cầu lớn, extension nhắm tới khoảng:

- 5 nhóm lớn
- tối đa 10 mục con cho mỗi nhóm
- 3-4 nhiệm vụ rất nhỏ cho mỗi mục con

Với yêu cầu ngắn, chế độ `auto` giảm số node để kế hoạch không bị dài vô ích.

## Vì sao bỏ tự code

- Model yếu dễ quá tải khi vừa phân tích, vừa sửa code, vừa chạy kiểm tra.
- Kế hoạch xếp tầng giúp giao từng prompt nhỏ cho từng lượt AI khác nhau.
- Người dùng kiểm soát tốt hơn phạm vi và thứ tự triển khai.

## Phần web còn giữ lại

Next dashboard/API vẫn ở repo như phần legacy để tham chiếu pipeline cũ. Luồng chính mới là extension trong `extensions/vscode`.
