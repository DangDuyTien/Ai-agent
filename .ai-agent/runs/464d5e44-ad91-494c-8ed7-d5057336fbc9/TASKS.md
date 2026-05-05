## 1. Rà soát tác động lên codebase hiện có

- Loại: codebase_impact_analysis
- Vùng tác động: existing_codebase
- Mục tiêu: Xác định file/module cần sửa trong repo hiện có trước khi thay đổi code.
- Tiêu chí nghiệm thu:
  - Chỉ ra file/module liên quan dựa trên ngữ cảnh codebase.
  - Giữ trình quản lý gói, framework và script hiện có.
  - Nếu cần thêm dependency, phải nêu lý do và rủi ro.

## 2. Hoàn thiện blueprint dự án

- Loại: blueprint_design
- Vùng tác động: planning
- Mục tiêu: Tổng hợp ý định, yêu cầu và chức năng thành blueprint cho dự án chưa rõ loại.
- Tiêu chí nghiệm thu:
  - Blueprint có project_type, target_users, problem, goals, constraints.
  - Chức năng đề xuất phù hợp với loại dự án.
  - Nếu thiếu thông tin, missing questions không quá 3 câu.

## 3. Chuẩn bị hợp đồng thực thi

- Loại: prompt_contract
- Vùng tác động: agent_orchestration
- Mục tiêu: Định nghĩa format prompt, output và checklist đánh giá cho agent lập trình.
- Tiêu chí nghiệm thu:
  - Mỗi tác vụ có mục tiêu, ràng buộc và tiêu chí nghiệm thu.
  - Prompt không yêu cầu API/database nếu kiến trúc không khuyến nghị.
  - Checklist đánh giá gắn với loại tác vụ.

## 4. Xây dựng luồng runtime theo ngữ cảnh

- Loại: runtime_flow
- Vùng tác động: runtime
- Mục tiêu: Tạo luồng runtime tối thiểu phù hợp với dự án không cần UI.
- Tiêu chí nghiệm thu:
  - Kết quả phải phục vụ: dự án chưa rõ loại giúp biến ý tưởng "rà soát lại dự án xem cần cải thiện ở đâu" thành kế hoạch và sản phẩm có thể thực thi.
  - Giữ phạm vi theo blueprint và tài liệu đã duyệt.
  - Có luồng CLI/service và log output rõ ràng.