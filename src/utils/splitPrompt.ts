import type { AiAnalysis, MasterPrompt } from "../types/prompt.type";
import type { Project } from "../types/project.type";
import type { AiRequest, ModelStrength, RequestedTaskType, SplitLevel, TaskType } from "../types/request.type";
import type { PromptTask, TaskDifficulty, TaskTreeResult } from "../types/task.type";
import { createId, nowIso } from "./id";
import { validateMasterPrompt } from "./validatePrompt";

interface TaskTemplate {
  title: string;
  description: string;
  relatedModules: string[];
  baseDifficulty: TaskDifficulty;
  requirements: string[];
  acceptanceCriteria: string[];
  warnings?: string[];
}

interface ModuleTemplate {
  title: string;
  description: string;
  relatedModules: string[];
  tasks: TaskTemplate[];
}

export function createLocalAnalysis(project: Project, request: AiRequest): AiAnalysis {
  const taskType = resolveRequestTaskType(request.originalPrompt, request.taskType);
  const modules = inferRelatedModules(request.originalPrompt, taskType);
  const now = nowIso();

  return {
    id: createId("analysis"),
    requestId: request.id,
    summary: `Phân tích yêu cầu "${request.originalPrompt}" trong project ${project.name}.`,
    task_type: taskType,
    main_goal: buildMainGoal(request.originalPrompt, taskType),
    scope: buildScope(taskType, modules),
    requirements: buildRequirements(request.originalPrompt, taskType, modules),
    risks: buildRisks(taskType, modules, request.modelStrength),
    related_modules: modules,
    output_expectation: "Có bản phân tích rõ ràng, prompt tổng chi tiết, cây task đa cấp và prompt nhỏ có thể copy cho AI coding model.",
    rawJson: {
      source: "local-generator",
      note: "Backend Gemini API có thể thay thế output này qua /api/requests/:id/analyze."
    },
    createdAt: now,
    updatedAt: now
  };
}

export function generateMasterPrompt(project: Project, request: AiRequest, analysis: AiAnalysis): MasterPrompt {
  const sourceType = project.sourceType ?? "blank";
  const content = [
    "# Prompt tổng cho AI coding model",
    "",
    "## Bối cảnh dự án",
    `- Tên project: ${project.name}`,
    `- Nguồn code: ${sourceType === "blank" ? "Chưa liên kết codebase" : `${sourceType} - ${project.sourceLocation || "chưa nhập"}`}`,
    `- Trạng thái scan context: ${project.scanStatus ?? "idle"}${project.lastScannedAt ? `, lần cuối ${project.lastScannedAt}` : ""}`,
    `- Mô tả: ${project.description || "Chưa có mô tả chi tiết."}`,
    `- Công nghệ đang dùng: ${project.technologies.length ? project.technologies.join(", ") : "Chưa khai báo."}`,
    `- Context: ${project.context?.overview || "Chưa có context."}`,
    project.context?.folderStructure ? `- Cấu trúc thư mục:\n${project.context.folderStructure}` : "- Cấu trúc thư mục: Chưa nhập.",
    "",
    "## Yêu cầu gốc",
    request.originalPrompt,
    "",
    "## Phân tích AI",
    `- Task type: ${analysis.task_type}`,
    `- Tóm tắt: ${analysis.summary}`,
    `- Mục tiêu chính: ${analysis.main_goal}`,
    `- Module liên quan: ${analysis.related_modules.join(", ") || "Chưa xác định"}`,
    "",
    "## Phạm vi cần làm",
    ...analysis.scope.map((item) => `- ${item}`),
    "",
    "## Yêu cầu chi tiết",
    ...analysis.requirements.map((item) => `- ${item}`),
    "",
    "## Luồng xử lý cần xem xét",
    "- Xác định file/module liên quan trước khi sửa.",
    "- Nếu có database, thiết kế migration/schema trước backend.",
    "- Nếu có API, hoàn thiện contract, validation, error handling trước UI.",
    "- Nếu có UI, đảm bảo loading/error/empty state và responsive.",
    "- Nếu có phân quyền, không bỏ qua kiểm tra user/session/role.",
    "",
    "## API nếu có",
    "- Nêu rõ endpoint, method, request body, response body, status code và lỗi cần xử lý.",
    "- Không thay đổi API public hiện có nếu không có yêu cầu rõ ràng.",
    "",
    "## Database nếu có",
    "- Thiết kế bảng/field/index/foreign key trước khi code.",
    "- Migration phải có rollback nếu framework hỗ trợ.",
    "- Không xoá dữ liệu cũ nếu không có kế hoạch migrate an toàn.",
    "",
    "## Validation và xử lý lỗi",
    "- Validate input từ client và server.",
    "- Xử lý lỗi network, lỗi quyền truy cập, lỗi dữ liệu không tồn tại và lỗi provider ngoài.",
    "- Không expose secret, token hoặc API key ra frontend/log không an toàn.",
    "",
    "## Không được phá vỡ",
    "- Không sửa chức năng ngoài phạm vi task.",
    "- Không đổi cấu trúc project lớn nếu không bắt buộc.",
    "- Không tự ý thêm thư viện nặng.",
    "- Không hard-code secret/API key.",
    "- Không xoá code cũ nếu chưa hiểu tác động.",
    "",
    "## Rủi ro cần cảnh báo",
    ...analysis.risks.map((item) => `- ${item}`),
    "",
    "## Tiêu chí hoàn thành",
    "- Code chạy được và đúng phạm vi yêu cầu.",
    "- Có loading/error state nếu có frontend.",
    "- Có validation nếu có form/API.",
    "- Có test hoặc checklist test thủ công.",
    "- Liệt kê file đã sửa và cách kiểm tra sau khi hoàn tất."
  ].join("\n");

  const now = nowIso();

  return {
    id: createId("master"),
    requestId: request.id,
    content,
    version: 1,
    validationIssues: validateMasterPrompt(content),
    createdAt: now,
    updatedAt: now
  };
}

export function splitPromptIntoTasks(
  project: Project,
  request: AiRequest,
  analysis: AiAnalysis,
  masterPrompt: MasterPrompt
): TaskTreeResult {
  const now = nowIso();
  const modules = createModuleTemplates(analysis, request);
  const root: PromptTask = {
    id: createId("task"),
    requestId: request.id,
    taskId: "G",
    title: analysis.main_goal,
    description: `Level 1: mục tiêu tổng cho yêu cầu "${request.originalPrompt}".`,
    level: 1,
    kind: "goal",
    difficulty: request.modelStrength === "weak" ? "medium" : "hard",
    status: "ready",
    depends_on: [],
    relatedModules: analysis.related_modules,
    prompt: masterPrompt.content,
    warnings: analysis.risks,
    acceptanceCriteria: [analysis.output_expectation],
    order: 0,
    children: [],
    createdAt: now,
    updatedAt: now
  };

  const orderedPrompts: PromptTask[] = [];
  let previousModuleLeafIds: string[] = [];

  modules.forEach((moduleTemplate, moduleIndex) => {
    const moduleNumber = moduleIndex + 1;
    const moduleNode = createModuleNode(moduleTemplate, request, moduleNumber, previousModuleLeafIds);
    const leafIdsInModule: string[] = [];

    moduleTemplate.tasks.forEach((taskTemplate, taskIndex) => {
      const taskId = `${moduleNumber}.${taskIndex + 1}`;
      const dependsOn = buildDependencies(moduleTemplate.title, taskIndex, previousModuleLeafIds, leafIdsInModule);
      const taskNode = createTaskNode({
        project,
        request,
        analysis,
        template: taskTemplate,
        moduleNode,
        taskId,
        dependsOn,
        order: orderedPrompts.length + 1
      });

      moduleNode.children?.push(taskNode);
      orderedPrompts.push(taskNode);
      leafIdsInModule.push(taskId);
    });

    root.children?.push(moduleNode);
    previousModuleLeafIds = leafIdsInModule.length ? leafIdsInModule : previousModuleLeafIds;
  });

  return { root, orderedPrompts };
}

export function splitTaskMore(task: PromptTask): PromptTask {
  if (task.kind !== "task") {
    return task;
  }

  const now = nowIso();
  const childTemplates = [
    {
      suffix: "a",
      title: "Rà soát phạm vi và file liên quan",
      description: "Chỉ đọc context, xác định file/module cần sửa và lập checklist thay đổi.",
      requirements: ["Xác định file liên quan", "Nêu rủi ro trước khi sửa", "Không sửa code ở bước này"]
    },
    {
      suffix: "b",
      title: "Thực hiện thay đổi chính",
      description: "Code phần chính của task với phạm vi nhỏ và không chạm module ngoài.",
      requirements: ["Implement đúng task", "Giữ nguyên API/behavior ngoài phạm vi", "Xử lý lỗi cơ bản"]
    },
    {
      suffix: "c",
      title: "Kiểm tra và hoàn thiện",
      description: "Chạy test/checklist, sửa lỗi nhỏ trong phạm vi task và báo cáo kết quả.",
      requirements: ["Chạy test liên quan", "Kiểm tra edge case", "Liệt kê file đã sửa"]
    }
  ];

  return {
    ...task,
    difficulty: task.difficulty === "critical" ? "critical" : "medium",
    children: childTemplates.map((template, index) => ({
      id: createId("task"),
      requestId: task.requestId,
      taskId: `${task.taskId}.${template.suffix}`,
      parentId: task.id,
      title: template.title,
      description: template.description,
      level: 4,
      kind: "prompt",
      difficulty: index === 1 ? task.difficulty : "easy",
      status: index === 0 ? "ready" : "pending",
      depends_on: index === 0 ? task.depends_on : [`${task.taskId}.${childTemplates[index - 1].suffix}`],
      relatedModules: task.relatedModules,
      prompt: buildTaskPrompt({
        title: `${task.title} - ${template.title}`,
        description: template.description,
        context: task.description,
        relatedModules: task.relatedModules,
        requirements: template.requirements,
        forbidden: defaultForbiddenRules(),
        expected: task.acceptanceCriteria,
        warnings: task.warnings
      }),
      warnings: task.warnings,
      acceptanceCriteria: task.acceptanceCriteria,
      order: task.order + index / 10,
      createdAt: now,
      updatedAt: now
    })),
    updatedAt: now
  };
}

export function flattenTasks(root?: PromptTask): PromptTask[] {
  if (!root) {
    return [];
  }

  return [root, ...(root.children?.flatMap((child) => flattenTasks(child)) ?? [])];
}

export function getOrderedExecutableTasks(root?: PromptTask): PromptTask[] {
  return flattenTasks(root)
    .filter((task) => {
      const hasSplitChildren = task.children?.some((child) => child.kind === "prompt" && !child.taskId.endsWith(".prompt"));
      if (task.kind === "task") {
        return !hasSplitChildren;
      }

      if (task.kind === "prompt") {
        return !task.taskId.endsWith(".prompt");
      }

      return false;
    })
    .filter((task) => Boolean(task.prompt.trim()))
    .sort((a, b) => a.order - b.order);
}

export function findTaskById(root: PromptTask | undefined, id: string | undefined): PromptTask | undefined {
  if (!root || !id) {
    return undefined;
  }

  if (root.id === id) {
    return root;
  }

  for (const child of root.children ?? []) {
    const found = findTaskById(child, id);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function updateTaskInTree(root: PromptTask, taskId: string, updater: (task: PromptTask) => PromptTask): PromptTask {
  if (root.id === taskId) {
    return updater(root);
  }

  return {
    ...root,
    children: root.children?.map((child) => updateTaskInTree(child, taskId, updater))
  };
}

function inferTaskType(prompt: string): TaskType {
  const text = prompt.toLowerCase();
  if (hasAny(text, ["bug", "lỗi", "fix", "sửa lỗi"])) return "bugfix";
  if (hasAny(text, ["ui", "giao diện", "responsive", "màn hình", "layout"])) return "ui";
  if (hasAny(text, ["refactor", "cải tạo", "dọn code", "clean code"])) return "refactor";
  if (hasAny(text, ["tối ưu", "performance", "cache", "nhanh hơn"])) return "optimization";
  if (hasAny(text, ["tài liệu", "document", "readme", "hướng dẫn"])) return "document";
  if (hasAny(text, ["phân tích", "audit", "review toàn bộ"])) return "analysis";
  return "feature";
}

function resolveRequestTaskType(prompt: string, requestedTaskType: RequestedTaskType): TaskType {
  if (requestedTaskType === "auto") {
    return inferTaskType(prompt);
  }

  return requestedTaskType;
}

function inferRelatedModules(prompt: string, taskType: TaskType): string[] {
  const text = prompt.toLowerCase();
  const modules = new Set<string>();

  const map: Array<[string[], string]> = [
    [["login", "đăng nhập", "google", "auth", "jwt", "session"], "auth"],
    [["cart", "giỏ hàng"], "cart"],
    [["checkout", "thanh toán"], "checkout"],
    [["order", "đơn hàng"], "order"],
    [["product", "sản phẩm"], "product"],
    [["admin", "dashboard quản trị"], "admin"],
    [["ui", "giao diện", "responsive", "layout"], "ui"],
    [["api", "backend", "endpoint"], "api"],
    [["database", "db", "bảng", "schema", "migration"], "database"],
    [["document", "tài liệu", "readme"], "docs"],
    [["performance", "tối ưu", "cache"], "performance"]
  ];

  map.forEach(([keywords, module]) => {
    if (keywords.some((keyword) => text.includes(keyword))) {
      modules.add(module);
    }
  });

  if (taskType === "ui") modules.add("ui");
  if (taskType === "document") modules.add("docs");
  if (taskType === "optimization") modules.add("performance");
  if (!modules.size) modules.add("core");

  return Array.from(modules);
}

function buildMainGoal(prompt: string, taskType: TaskType): string {
  const prefixByType: Record<TaskType, string> = {
    feature: "Xây dựng chức năng",
    bugfix: "Sửa lỗi",
    ui: "Cải thiện giao diện",
    refactor: "Refactor",
    optimization: "Tối ưu",
    document: "Viết/cập nhật tài liệu",
    analysis: "Phân tích hệ thống"
  };

  return `${prefixByType[taskType]}: ${prompt}`;
}

function buildScope(taskType: TaskType, modules: string[]): string[] {
  const scope = [
    "Phân tích context dự án và xác định file/module liên quan.",
    "Tạo prompt tổng đủ chi tiết để AI coding model hiểu mục tiêu, ràng buộc và tiêu chí hoàn thành.",
    "Chia prompt thành task nhỏ theo thứ tự phụ thuộc và độ khó."
  ];

  if (modules.includes("database")) scope.push("Thiết kế database/migration trước khi sửa backend.");
  if (modules.includes("api") || taskType === "feature") scope.push("Xác định API contract, validation và error handling nếu có backend.");
  if (modules.includes("ui") || taskType === "ui") scope.push("Thiết kế UI state gồm loading, error, empty và responsive.");
  if (taskType === "document") scope.push("Tạo tài liệu rõ ràng, có cấu trúc, dễ bảo trì.");

  return scope;
}

function buildRequirements(prompt: string, taskType: TaskType, modules: string[]): string[] {
  const requirements = [
    `Làm rõ yêu cầu gốc: ${prompt}`,
    "Mỗi prompt nhỏ chỉ thực hiện một việc rõ ràng.",
    "Mỗi task có trạng thái, độ khó, phụ thuộc và tiêu chí kiểm tra.",
    "Không hard-code secret/API key và không gọi AI provider trực tiếp từ frontend."
  ];

  if (taskType === "feature") requirements.push("Bổ sung đầy đủ luồng happy path, edge case và kiểm tra quyền nếu cần.");
  if (taskType === "bugfix") requirements.push("Tái hiện lỗi, sửa đúng nguyên nhân và tránh regression.");
  if (taskType === "ui") requirements.push("Đảm bảo giao diện dễ scan, không chồng chéo text và có trạng thái responsive.");
  if (taskType === "optimization") requirements.push("Đo baseline trước khi tối ưu và kiểm tra không đổi behavior.");
  if (modules.includes("auth")) requirements.push("Không expose token, secret hoặc thông tin nhạy cảm.");

  return requirements;
}

function buildRisks(taskType: TaskType, modules: string[], modelStrength: ModelStrength): string[] {
  const risks = [
    "Prompt quá rộng có thể khiến AI sửa lan man ngoài phạm vi.",
    "Thiếu context file/module có thể làm AI chọn sai vị trí sửa code."
  ];

  if (modelStrength === "weak") risks.push("Model yếu cần prompt ngắn, task nhỏ và tiêu chí hoàn thành cụ thể.");
  if (modules.includes("database")) risks.push("Thay đổi schema có thể ảnh hưởng dữ liệu cũ, cần backup/migration an toàn.");
  if (modules.includes("auth")) risks.push("Luồng auth có rủi ro bảo mật, token/session và phân quyền cần review kỹ.");
  if (taskType === "optimization") risks.push("Tối ưu hiệu năng có thể làm thay đổi behavior nếu không có test baseline.");
  if (taskType === "refactor") risks.push("Refactor dễ gây regression nếu thiếu test bao phủ luồng cũ.");

  return risks;
}

function createModuleTemplates(analysis: AiAnalysis, request: AiRequest): ModuleTemplate[] {
  const modules: ModuleTemplate[] = [
    {
      title: "Phân tích phạm vi",
      description: "Xác định phạm vi, rủi ro và vùng code có thể liên quan trước khi sửa.",
      relatedModules: ["core"],
      tasks: [
        {
          title: "Rà soát context và lập checklist thay đổi",
          description: "Đọc context dự án, xác định module/file liên quan và lập checklist triển khai.",
          relatedModules: analysis.related_modules,
          baseDifficulty: "easy",
          requirements: [
            "Tóm tắt yêu cầu thật sự cần làm",
            "Liệt kê file/module có thể liên quan",
            "Nêu rủi ro trước khi chỉnh code"
          ],
          acceptanceCriteria: ["Có checklist phạm vi và rủi ro trước khi implement."]
        }
      ]
    }
  ];

  if (needsDatabase(analysis)) {
    modules.push({
      title: "Database",
      description: "Thiết kế schema, migration và quan hệ dữ liệu trước backend.",
      relatedModules: ["database"],
      tasks: [
        {
          title: "Thiết kế schema và migration",
          description: "Tạo hoặc cập nhật bảng, field, index và foreign key cần thiết.",
          relatedModules: ["database"],
          baseDifficulty: "hard",
          requirements: ["Thiết kế bảng/field/index", "Có rollback nếu framework hỗ trợ", "Không xoá dữ liệu cũ khi chưa cần"],
          acceptanceCriteria: ["Migration rõ ràng, có quan hệ dữ liệu và không phá schema cũ."],
          warnings: ["Cần backup nếu sửa bảng đang có dữ liệu."]
        },
        {
          title: "Cập nhật model/repository liên quan",
          description: "Cập nhật model, repository, factory hoặc seed dữ liệu nếu dự án có tầng này.",
          relatedModules: ["database", "backend"],
          baseDifficulty: "medium",
          requirements: ["Map field mới vào model", "Giữ convention hiện có", "Không đổi contract ngoài phạm vi"],
          acceptanceCriteria: ["Model/repository khớp schema mới."]
        }
      ]
    });
  }

  if (needsBackend(analysis, analysis.task_type)) {
    modules.push({
      title: "Backend API",
      description: "Thiết kế contract, implement service/controller và xử lý lỗi.",
      relatedModules: ["api", "backend"],
      tasks: backendTasks(analysis, request)
    });
  }

  if (needsFrontend(analysis, analysis.task_type)) {
    modules.push({
      title: "Frontend UI",
      description: "Tạo/cập nhật UI, state, API service và các trạng thái hiển thị.",
      relatedModules: ["ui", "frontend"],
      tasks: frontendTasks(analysis, request)
    });
  }

  modules.push({
    title: "Test & bàn giao",
    description: "Kiểm tra luồng chính, edge cases và ghi tài liệu ngắn.",
    relatedModules: ["test", "docs"],
    tasks: [
      {
        title: "Kiểm tra luồng chính và edge cases",
        description: "Chạy test liên quan hoặc checklist thủ công theo phạm vi đã sửa.",
        relatedModules: ["test"],
        baseDifficulty: "medium",
        requirements: ["Test happy path", "Test lỗi/empty/permission nếu có", "Ghi rõ lệnh đã chạy"],
        acceptanceCriteria: ["Có kết quả test và danh sách rủi ro còn lại."]
      },
      {
        title: "Cập nhật tài liệu bàn giao",
        description: "Ghi lại file đã sửa, cách test và những điểm cần review.",
        relatedModules: ["docs"],
        baseDifficulty: "easy",
        requirements: ["Liệt kê file đã sửa", "Mô tả ngắn thay đổi", "Nêu cách test lại"],
        acceptanceCriteria: ["Bàn giao đủ thông tin để reviewer kiểm tra nhanh."]
      }
    ]
  });

  return applyGranularity(modules, request);
}

function backendTasks(analysis: AiAnalysis, request: AiRequest): TaskTemplate[] {
  const tasks: TaskTemplate[] = [
    {
      title: "Thiết kế API contract",
      description: "Xác định endpoint, method, request/response, status code và lỗi.",
      relatedModules: ["api"],
      baseDifficulty: "medium",
      requirements: ["Nêu endpoint/method", "Nêu request/response schema", "Nêu lỗi 400/401/403/404/500 nếu phù hợp"],
      acceptanceCriteria: ["API contract rõ trước khi implement."]
    },
    {
      title: "Implement service/controller",
      description: "Code phần backend chính theo contract và convention dự án.",
      relatedModules: ["backend", ...analysis.related_modules],
      baseDifficulty: hasCriticalModule(analysis) ? "critical" : "hard",
      requirements: ["Tách logic vào service nếu dự án có pattern này", "Không bỏ qua xử lý lỗi", "Không expose secret"],
      acceptanceCriteria: ["Endpoint/service chạy đúng happy path và lỗi chính."]
    },
    {
      title: "Validate input và phân quyền",
      description: "Thêm validation server-side và kiểm tra user/session/role nếu cần.",
      relatedModules: ["backend", "auth"],
      baseDifficulty: analysis.related_modules.includes("auth") ? "critical" : "medium",
      requirements: ["Validate input bắt buộc", "Kiểm tra quyền truy cập", "Trả lỗi nhất quán"],
      acceptanceCriteria: ["Input xấu và user không đủ quyền bị chặn đúng."]
    }
  ];

  if (request.splitLevel === "very_detailed" || request.modelStrength === "weak") {
    tasks.splice(2, 0, {
      title: "Chuẩn hóa response và error format",
      description: "Đảm bảo response thành công/lỗi nhất quán với codebase.",
      relatedModules: ["api", "backend"],
      baseDifficulty: "easy",
      requirements: ["Giữ format response hiện có", "Không đổi contract ngoài phạm vi", "Log lỗi an toàn"],
      acceptanceCriteria: ["Frontend có thể xử lý response/lỗi ổn định."]
    });
  }

  return tasks;
}

function frontendTasks(analysis: AiAnalysis, request: AiRequest): TaskTemplate[] {
  const tasks: TaskTemplate[] = [
    {
      title: "Tạo API service và state flow",
      description: "Cập nhật client API, state loading/error/success và mapping dữ liệu.",
      relatedModules: ["frontend", "api"],
      baseDifficulty: "medium",
      requirements: ["Dùng API service thay vì gọi trực tiếp trong component", "Có loading/error state", "Không hard-code data"],
      acceptanceCriteria: ["UI nhận data qua service/state rõ ràng."]
    },
    {
      title: "Xây dựng hoặc chỉnh UI chính",
      description: "Tạo component/page cần thiết theo yêu cầu, tối ưu scan và thao tác lặp.",
      relatedModules: ["ui", ...analysis.related_modules],
      baseDifficulty: analysis.task_type === "ui" ? "hard" : "medium",
      requirements: ["Giao diện rõ ràng, dễ scan", "Text không tràn/chồng chéo", "Có empty state nếu thiếu dữ liệu"],
      acceptanceCriteria: ["UI đúng mục tiêu và dùng được trên desktop/mobile."]
    },
    {
      title: "Hoàn thiện tương tác và trạng thái lỗi",
      description: "Bổ sung copy/export/modal/action/error state tùy phạm vi yêu cầu.",
      relatedModules: ["ui", "frontend"],
      baseDifficulty: "medium",
      requirements: ["Có trạng thái loading/error/empty", "Disable action khi dữ liệu chưa hợp lệ", "Hiển thị message lỗi dễ hiểu"],
      acceptanceCriteria: ["Người dùng hiểu trạng thái hệ thống và không bị kẹt workflow."]
    }
  ];

  if (request.splitLevel !== "normal" || request.modelStrength === "weak") {
    tasks.push({
      title: "Kiểm tra responsive và accessibility cơ bản",
      description: "Kiểm tra layout ở desktop/mobile, focus state và label điều khiển.",
      relatedModules: ["ui", "accessibility"],
      baseDifficulty: "easy",
      requirements: ["Không overlap nội dung", "Button/input có label rõ", "Keyboard focus không bị mất"],
      acceptanceCriteria: ["UI không vỡ ở viewport phổ biến."]
    });
  }

  return tasks;
}

function applyGranularity(modules: ModuleTemplate[], request: AiRequest): ModuleTemplate[] {
  if (request.splitLevel === "normal" && request.modelStrength !== "weak") {
    return modules;
  }

  return modules.map((module) => ({
    ...module,
    tasks: module.tasks.flatMap((task) => {
      if (task.baseDifficulty === "easy") return [task];
      if (task.baseDifficulty === "medium" && request.splitLevel !== "very_detailed" && request.modelStrength !== "weak") return [task];

      return [
        {
          ...task,
          title: `${task.title} - chuẩn bị`,
          description: `Chuẩn bị context, file liên quan và checklist cho: ${task.description}`,
          baseDifficulty: "easy",
          requirements: ["Đọc context liên quan", "Lập checklist thay đổi", "Không sửa code ngoài phạm vi ở bước chuẩn bị"],
          acceptanceCriteria: ["Có checklist trước khi implement."]
        },
        {
          ...task,
          title: `${task.title} - implement`,
          description: `Thực hiện phần chính: ${task.description}`,
          baseDifficulty: task.baseDifficulty,
          requirements: task.requirements,
          acceptanceCriteria: task.acceptanceCriteria
        }
      ];
    })
  }));
}

function createModuleNode(
  template: ModuleTemplate,
  request: AiRequest,
  moduleNumber: number,
  previousModuleLeafIds: string[]
): PromptTask {
  const now = nowIso();
  return {
    id: createId("task"),
    requestId: request.id,
    taskId: `${moduleNumber}`,
    title: template.title,
    description: template.description,
    level: 2,
    kind: "module",
    difficulty: "medium",
    status: previousModuleLeafIds.length ? "pending" : "ready",
    depends_on: previousModuleLeafIds,
    relatedModules: template.relatedModules,
    prompt: "",
    warnings: [],
    acceptanceCriteria: [],
    order: moduleNumber,
    children: [],
    createdAt: now,
    updatedAt: now
  };
}

function createTaskNode(args: {
  project: Project;
  request: AiRequest;
  analysis: AiAnalysis;
  template: TaskTemplate;
  moduleNode: PromptTask;
  taskId: string;
  dependsOn: string[];
  order: number;
}): PromptTask {
  const { project, request, analysis, template, moduleNode, taskId, dependsOn, order } = args;
  const now = nowIso();
  const difficulty = normalizeDifficulty(template.baseDifficulty, request.modelStrength);
  const status = dependsOn.length ? "pending" : "ready";
  const sourceType = project.sourceType ?? "blank";
  const prompt = buildTaskPrompt({
    title: template.title,
    description: template.description,
    context: [
      `Project: ${project.name}`,
      sourceType !== "blank" ? `Nguồn codebase: ${project.sourceLocation || "chưa nhập"}` : "",
      `Trạng thái scan context: ${project.scanStatus ?? "idle"}`,
      `Yêu cầu gốc: ${request.originalPrompt}`,
      `Mục tiêu: ${analysis.main_goal}`,
      `Module cha: ${moduleNode.title}`,
      project.context?.overview ? `Context dự án: ${project.context.overview}` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    relatedModules: template.relatedModules,
    requirements: template.requirements,
    forbidden: defaultForbiddenRules(),
    expected: template.acceptanceCriteria,
    warnings: template.warnings ?? []
  });

  return {
    id: createId("task"),
    requestId: request.id,
    taskId,
    parentId: moduleNode.id,
    title: template.title,
    description: template.description,
    level: 3,
    kind: "task",
    difficulty,
    status,
    depends_on: dependsOn,
    relatedModules: template.relatedModules,
    prompt,
    warnings: template.warnings ?? [],
    acceptanceCriteria: template.acceptanceCriteria,
    order,
    children: [
      {
        id: createId("task"),
        requestId: request.id,
        taskId: `${taskId}.prompt`,
        parentId: taskId,
        title: "Prompt thực thi cụ thể",
        description: "Level 4: prompt nhỏ để copy cho AI coding assistant.",
        level: 4,
        kind: "prompt",
        difficulty,
        status,
        depends_on: dependsOn,
        relatedModules: template.relatedModules,
        prompt,
        warnings: template.warnings ?? [],
        acceptanceCriteria: template.acceptanceCriteria,
        order: order + 0.01,
        createdAt: now,
        updatedAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}

function buildTaskPrompt(args: {
  title: string;
  description: string;
  context: string;
  relatedModules: string[];
  requirements: string[];
  forbidden: string[];
  expected: string[];
  warnings: string[];
}): string {
  return [
    "Bạn là AI coding assistant.",
    "Chỉ thực hiện task sau:",
    "",
    "Task:",
    `${args.title}`,
    `${args.description}`,
    "",
    "Bối cảnh:",
    args.context,
    "",
    "File/Module liên quan:",
    ...(args.relatedModules.length ? args.relatedModules.map((item) => `- ${item}`) : ["- Chưa xác định, hãy đọc codebase để tìm đúng module."]),
    "",
    "Yêu cầu cần làm:",
    ...args.requirements.map((item) => `- ${item}`),
    "",
    "Không được làm:",
    ...args.forbidden.map((item) => `- ${item}`),
    "",
    "Kết quả mong muốn:",
    ...args.expected.map((item) => `- ${item}`),
    "",
    args.warnings.length ? "Cảnh báo rủi ro:" : "",
    ...args.warnings.map((item) => `- ${item}`),
    args.warnings.length ? "" : "",
    "Sau khi làm xong:",
    "- Liệt kê file đã sửa.",
    "- Giải thích ngắn gọn đã làm gì.",
    "- Nêu cách test."
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildDependencies(
  moduleTitle: string,
  taskIndex: number,
  previousModuleLeafIds: string[],
  leafIdsInModule: string[]
): string[] {
  if (taskIndex > 0 && leafIdsInModule.length) {
    return [leafIdsInModule[leafIdsInModule.length - 1]];
  }

  if (["Backend API", "Frontend UI", "Test & bàn giao"].includes(moduleTitle)) {
    return previousModuleLeafIds;
  }

  return [];
}

function normalizeDifficulty(difficulty: TaskDifficulty, modelStrength: ModelStrength): TaskDifficulty {
  if (modelStrength !== "weak") {
    return difficulty;
  }

  if (difficulty === "hard") {
    return "medium";
  }

  return difficulty;
}

function defaultForbiddenRules(): string[] {
  return [
    "Không sửa chức năng ngoài phạm vi.",
    "Không xoá code cũ nếu không cần.",
    "Không đổi cấu trúc project nếu không được yêu cầu.",
    "Không tự ý thêm thư viện nặng.",
    "Không hard-code secret/API key.",
    "Không bỏ qua test hoặc checklist kiểm tra."
  ];
}

function needsDatabase(analysis: AiAnalysis): boolean {
  return analysis.related_modules.some((module) => ["database", "cart", "checkout", "order", "auth"].includes(module));
}

function needsBackend(analysis: AiAnalysis, taskType: TaskType): boolean {
  if (taskType === "document" || taskType === "ui") {
    return analysis.related_modules.some((module) => ["api", "auth", "cart", "checkout", "order", "admin"].includes(module));
  }

  return taskType !== "analysis" || analysis.related_modules.includes("api");
}

function needsFrontend(analysis: AiAnalysis, taskType: TaskType): boolean {
  return taskType === "feature" || taskType === "ui" || analysis.related_modules.some((module) => ["ui", "cart", "product", "admin", "checkout", "auth"].includes(module));
}

function hasCriticalModule(analysis: AiAnalysis): boolean {
  return analysis.related_modules.some((module) => ["auth", "checkout", "payment", "order"].includes(module));
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
