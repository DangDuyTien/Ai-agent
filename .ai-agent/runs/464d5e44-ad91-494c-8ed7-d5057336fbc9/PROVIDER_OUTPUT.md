## Kế hoạch triển khai

Dự án hiện tại là một ứng dụng AI agent xây dựng trên Next.js/React/TypeScript, có khả năng quản lý dự án, phân tích và thực thi các tác vụ. Mục tiêu chung là biến ý tưởng "rà soát lại dự án xem cần cải thiện ở đâu" thành một kế hoạch và sản phẩm có thể thực thi trong ngữ cảnh ứng dụng AI agent này.

### Tác vụ 1: Rà soát tác động lên codebase hiện có

**Mục tiêu:** Xác định các file/module hiện có cần được sửa đổi để tích hợp chức năng "rà soát dự án để tìm cải tiến".

**Kế hoạch:**
Chúng ta sẽ tập trung vào các API routes hiện có liên quan đến việc phân tích và tạo blueprint, cũng như giao diện người dùng tối thiểu để kích hoạt và xem kết quả rà soát.
1.  **Mở rộng logic phân tích:** Cập nhật route `app/api/projects/[projectId]/analyze/route.ts` để bao gồm khả năng phân tích một dự án theo ngữ cảnh và đưa ra các đề xuất cải tiến. Đây là trung tâm của chức năng "rà soát".
2.  **Cập nhật logic tạo blueprint:** Điều chỉnh route `app/api/projects/[projectId]/blueprint/route.ts` để nó có thể tạo ra một blueprint hoặc kế hoạch hành động dựa trên các đề xuất cải tiến từ bước phân tích.
3.  **Giao diện người dùng tối thiểu:** Thêm các yếu tố giao diện cần thiết vào `app/page.tsx` để người dùng có thể nhập yêu cầu rà soát và xem kết quả sơ bộ hoặc trạng thái của quá trình rà soát.

**Files sẽ sửa:**
*   `app/api/projects/[projectId]/analyze/route.ts`: Thêm logic AI để rà soát codebase và đề xuất cải tiến.
*   `app/api/projects/[projectId]/blueprint/route.ts`: Sửa đổi để có thể tạo blueprint dựa trên kết quả rà soát.
*   `app/page.tsx`: Sửa đổi để cung cấp một giao diện người dùng tối thiểu cho việc khởi tạo quá trình rà soát dự án và hiển thị kết quả.
*   `package.json`: (Không có sự thay đổi dự kiến cho tác vụ này, trừ khi có dependency mới *thực sự cần thiết* cho logic phân tích, điều này không được giả định ban đầu).

**Kiểm chứng:**
*   Sử dụng công cụ như Postman/Insomnia để gọi API `POST /api/projects/[projectId]/analyze` với một ngữ cảnh dự án và kiểm tra xem phản hồi có chứa các gợi ý cải tiến hay không.
*   Gọi API `GET /api/projects/[projectId]/blueprint` sau khi phân tích để xem blueprint có được tạo ra phù hợp không.
*   Chạy `npm run dev` và truy cập ứng dụng để kiểm tra giao diện người dùng mới có hoạt động như mong đợi không.

---

### Tác vụ 2: Hoàn thiện blueprint dự án

**Mục tiêu:** Tổng hợp ý định, yêu cầu và chức năng thành một bản blueprint rõ ràng cho tính năng "AI-driven Project Improvement & Review".

**Kế hoạch:**
Tạo một file định nghĩa blueprint mới, chứa các thông tin chi tiết về loại dự án, người dùng mục tiêu, vấn đề cần giải quyết, mục tiêu, ràng buộc và các chức năng cốt lõi của tính năng rà soát dự án. Blueprint này sẽ đóng vai trò là tài liệu hướng dẫn cho các tác vụ tiếp theo.

**Files sẽ tạo:**
*   `src/blueprints/project_review_blueprint.json`: Một file JSON định nghĩa cấu trúc và nội dung của blueprint cho tính năng "AI-driven Project Improvement & Review".

**Nội dung dự kiến của `project_review_blueprint.json`:**
```json
{
  "project_type": "AI-driven Project Improvement & Review",
  "target_users": ["End-users", "Product Managers", "Developers"],
  "problem": "Projects often lack clear direction for improvement; manual review is time-consuming and subjective. Users need systematic identification of improvement areas and actionable plans.",
  "goals": [
    "Automatically identify areas for improvement in a given project (e.g., code quality, performance, security, features).",
    "Generate a clear, actionable plan/blueprint for suggested improvements.",
    "Provide a mechanism for reviewing and approving proposed changes.",
    "Integrate seamlessly with existing project management and development workflows."
  ],
  "constraints": [
    "Leverage existing Next.js/React/TypeScript stack.",
    "Avoid unnecessary new infrastructure (web UI, API, DB) unless explicitly required by blueprint.",
    "Focus on diffs over full refactor.",
    "Initial output should be a blueprint/prototype."
  ],
  "core_functions": [
    "Contextual Project Ingestion (e.g., codebase analysis, idea import)",
    "AI-powered Improvement Analysis & Suggestion",
    "Dynamic Blueprint Generation for recommended changes",
    "Impact Assessment and Pre-review Gate for major changes",
    "Agent Log/History Tracking",
    "Roadmap/Task Decomposition from blueprint",
    "Human Review Loop for suggestions"
  ],
  "missing_questions": []
}
```

**Kiểm chứng:**
*   Mở file `src/blueprints/project_review_blueprint.json` để xác minh rằng nó chứa tất cả các thành phần yêu cầu (`project_type`, `target_users`, `problem`, `goals`, `constraints`) và các chức năng được đề xuất phù hợp với loại dự án.
*   Đảm bảo không có hơn 3 câu hỏi còn thiếu trong mục `missing_questions`.

---

### Tác vụ 3: Chuẩn bị hợp đồng thực thi

**Mục tiêu:** Định nghĩa format prompt đầu vào, format output mong đợi và checklist đánh giá cho agent lập trình khi thực hiện tác vụ rà soát dự án.

**Kế hoạch:**
Tạo một file định nghĩa "hợp đồng" mới, sử dụng TypeScript để định nghĩa các interface/schema cho:
1.  **Prompt:** Cấu trúc của các instruction được gửi đến agent AI cho tác vụ "Project Review".
2.  **Output:** Cấu trúc của kết quả mà agent AI mong muốn trả về sau khi thực hiện rà soát.
3.  **Evaluation Checklist:** Các tiêu chí để đánh giá chất lượng và sự hoàn chỉnh của output từ agent.

**Files sẽ tạo:**
*   `src/agent_contracts/project_review_contract.ts`: Một file TypeScript định nghĩa các interface cho `ProjectReviewPrompt`, `ProjectReviewOutput` và `ProjectReviewEvaluationChecklist`.

**Nội dung dự kiến của `src/agent_contracts/project_review_contract.ts`:**
```typescript
/**
 * @file Định nghĩa hợp đồng thực thi cho tác vụ "Project Review" của AI Agent.
 * Bao gồm cấu trúc prompt đầu vào, format output mong đợi và checklist đánh giá.
 */

export interface ProjectReviewPrompt {
  taskId: string;
  projectId: string;
  taskTitle: "Analyze Codebase for Improvements";
  taskDescription: string;
  context: {
    codebasePath?: string; // Đường dẫn tới codebase để phân tích
    codebaseContent?: string; // Hoặc nội dung trực tiếp nếu là file nhỏ
    existingRequirements?: string; // Các yêu cầu hiện có của dự án
    userDefinedFocusAreas?: string[]; // Các lĩnh vực người dùng muốn tập trung (e.g., ["performance", "security"])
  };
  constraints: string[];
  outputFormatSchema: any; // Schema JSON mong đợi của output
}

export interface ProjectReviewOutput {
  reviewSummary: string;
  improvementCategories: {
    category: string; // e.g., "Code Quality", "Performance", "Security", "Feature Suggestions"
    suggestions: {
      id: string;
      title: string;
      description: string;
      impact: string; // e.g., "Maintainability", "User Experience"
      severity: "Low" | "Medium" | "High" | "Critical";
      proposedAction: string; // Hành động cụ thể đề xuất
      filesAffected?: string[]; // Các file có thể bị ảnh hưởng
      rationale?: string; // Lý do đề xuất
    }[];
  }[];
  potentialRisks?: string[]; // Các rủi ro tiềm ẩn khi áp dụng các cải tiến
}

export interface ProjectReviewEvaluationChecklist {
  [key: string]: {
    description: string;
    criteria: string[];
  };
}

export const projectReviewEvaluationChecklist: ProjectReviewEvaluationChecklist = {
  coverage: {
    description: "Đảm bảo tất cả các khía cạnh quan trọng của dự án được xem xét.",
    criteria: [
      "Kết quả đánh giá bao gồm các gợi ý về chất lượng code, hiệu suất, bảo mật, và chức năng (nếu có).",
      "Các lĩnh vực tập trung do người dùng định nghĩa đã được ưu tiên xem xét.",
    ],
  },
  actionability: {
    description: "Các gợi ý cải tiến phải rõ ràng và có thể thực hiện được.",
    criteria: [
      "Mỗi gợi ý đều có một 'hành động đề xuất' cụ thể.",
      "Các gợi ý đủ chi tiết để một lập trình viên có thể hiểu và thực hiện.",
    ],
  },
  justification: {
    description: "Mỗi gợi ý cải tiến phải có lý do hợp lý.",
    criteria: [
      "Mỗi gợi ý bao gồm lý do (rationale) hoặc giải thích về lợi ích/vấn đề nó giải quyết.",
      "Lý do dựa trên ngữ cảnh codebase được cung cấp.",
    ],
  },
  contextAdherence: {
    description: "Đầu ra tuân thủ các ràng buộc và ngữ cảnh đã cho.",
    criteria: [
      "Không đề xuất các thay đổi yêu cầu API/database bên ngoài nếu kiến trúc không khuyến nghị.",
      "Tuân thủ các ràng buộc khác được cung cấp trong prompt.",
    ],
  },
  formatCompliance: {
    description: "Đầu ra phải tuân thủ đúng format schema đã định nghĩa.",
    criteria: [
      "Đầu ra là JSON hợp lệ.",
      "Cấu trúc JSON đầu ra khớp với 'ProjectReviewOutput' interface.",
    ],
  },
};
```

**Kiểm chứng:**
*   Mở file `src/agent_contracts/project_review_contract.ts` để xác minh rằng các interface `ProjectReviewPrompt`, `ProjectReviewOutput` và `ProjectReviewEvaluationChecklist` đã được định nghĩa rõ ràng.
*   Đảm bảo rằng prompt không yêu cầu API/database nếu kiến trúc không khuyến nghị.
*   Kiểm tra xem checklist đánh giá có gắn liền với các tiêu chí cụ thể cho tác vụ rà soát dự án hay không.
*   Chạy `tsc --noEmit src/agent_contracts/project_review_contract.ts` để đảm bảo không có lỗi cú pháp TypeScript.