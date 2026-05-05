import { createId } from "@/lib/store";
import {
  architecturePlanContentSchema,
  executionPromptContentSchema,
  featureDiscoveryContentSchema,
  intentAnalysisContentSchema,
  requirementsContentSchema
} from "@/packages/schemas/project-blueprint.schema";
import type {
  ArchitecturePlan,
  CodebaseContext,
  ExecutionPrompt,
  FeatureDiscovery,
  FileEditPlan,
  IntentAnalysis,
  Project,
  ProjectTask,
  Requirements,
  RoadmapMilestone
} from "@/packages/schemas/project-blueprint.schema";

type TaskDraft = Omit<ProjectTask, "projectId" | "createdAt" | "updatedAt">;

interface CodexApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ProviderExecutionResult {
  provider: string;
  mode: string;
  output: string;
}

export interface ProviderFileEditResult {
  provider: string;
  mode: string;
  output: string;
  plan: FileEditPlan;
}

export interface ProviderTaskPlanResult {
  provider: string;
  mode: string;
  output: string;
  roadmap: RoadmapMilestone[];
  tasks: TaskDraft[];
}

export interface ProviderArtifactResult<TContent> {
  provider: string;
  mode: string;
  output: string;
  content: TContent;
}

export function isLiveProviderConfigured() {
  return getProviderMode() !== "mock" && Boolean(getCodexApiConfig() || process.env.GEMINI_API_KEY);
}

export function getPreferredProviderStatus() {
  const codex = getCodexApiConfig();
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  return {
    providerMode: getProviderMode(),
    codexApiConfigured: Boolean(codex),
    codexApiModel: codex?.model,
    geminiConfigured,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    preferredProvider: codex ? "codex-api" : geminiConfigured ? "gemini" : "mock",
    fallbackProvider: geminiConfigured ? "gemini" : "mock"
  };
}

export async function runCodingProvider(prompts: ExecutionPrompt[]): Promise<ProviderExecutionResult> {
  return runWithPreferredProviders({
    codex: () => runCodexProvider(prompts),
    gemini: () => runGeminiProvider(prompts),
    mock: (reason) => ({
      provider: getProviderMode(),
      mode: "mock",
      output: [
        "Provider adapter đang chạy ở chế độ mock.",
        `Lý do: ${reason}`,
        `Đã chuẩn bị ${prompts.length} prompt thực thi cho agent lập trình.`,
        "Cấu hình AI_AGENT_CODEX_API_KEY/CODEX_API_KEY/OPENAI_API_KEY để ưu tiên Codex, hoặc GEMINI_API_KEY để fallback."
      ].join("\n")
    })
  });
}

export async function runIntentAnalysisProvider(input: {
  project: Project;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderArtifactResult<IntentAnalysis>> {
  return runStructuredPlanningProvider({
    agentLabel: "Intent Analyzer",
    schemaDescription:
      '{"projectType":"web_app|mobile_app|saas|bot|automation_tool|game|ai_tool|trading_bot|landing_page|unknown","confidence":0.0,"reasoning":"...","targetPlatforms":["..."],"missingQuestions":["..."],"initialAssumptions":["..."],"signals":["..."]}',
    rules: [
      "Phân loại theo tín hiệu thật trong ý tưởng, không mặc định web_app nếu không có tín hiệu web/dashboard/browser.",
      "Nếu mode là existing_project, cân nhắc codebase_context nhưng vẫn ưu tiên ý tưởng người dùng.",
      "Nếu rawIdea có các khối 'Yêu cầu phát triển tiếp', xem đó là yêu cầu mới nhất cần ưu tiên trong lần phân tích này.",
      "missingQuestions chỉ gồm câu thật sự chặn quyết định lớn, tối đa 3 câu."
    ],
    context: {
      rawIdea: input.project.rawIdea,
      mode: input.project.mode,
      sourcePath: input.project.sourcePath,
      codebaseContext: summarizeCodebaseContext(input.codebaseContext)
    },
    parse: (value) => intentAnalysisContentSchema.parse(value)
  });
}

export async function runRequirementsProvider(input: {
  project: Project;
  intent: IntentAnalysis;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderArtifactResult<Requirements>> {
  return runStructuredPlanningProvider({
    agentLabel: "Requirement Builder",
    schemaDescription:
      '{"projectName":"...","oneLineSummary":"...","targetUsers":["..."],"problemStatement":"...","primaryGoals":["..."],"nonGoals":["..."],"constraints":["..."],"successMetrics":["..."]}',
    rules: [
      "Yêu cầu phải xuất phát trực tiếp từ ý tưởng người dùng và intent_analysis.",
      "Nếu rawIdea có các khối 'Yêu cầu phát triển tiếp', giữ bối cảnh dự án cũ nhưng đưa yêu cầu mới nhất vào primaryGoals.",
      "Không thêm API, database, auth, dashboard hoặc CRUD nếu ý tưởng/intent không cần.",
      "Nếu là existing_project, primaryGoals/constraints phải nêu hướng sửa/nâng cấp codebase hiện có."
    ],
    context: {
      rawIdea: input.project.rawIdea,
      mode: input.project.mode,
      sourcePath: input.project.sourcePath,
      intent: input.intent,
      codebaseContext: summarizeCodebaseContext(input.codebaseContext)
    },
    parse: (value) => requirementsContentSchema.parse(value)
  });
}

export async function runFeatureDiscoveryProvider(input: {
  project: Project;
  intent: IntentAnalysis;
  requirements: Requirements;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderArtifactResult<FeatureDiscovery>> {
  return runStructuredPlanningProvider({
    agentLabel: "Feature Discovery",
    schemaDescription:
      '{"coreFeatures":["..."],"optionalFeatures":["..."],"typeSpecific":{"domainKey":["..."]},"excludedByDesign":["..."]}',
    rules: [
      "Đề xuất feature theo domain của ý tưởng, không dùng danh sách chung cố định.",
      "Nếu đây là yêu cầu phát triển tiếp, coreFeatures phải tập trung vào chức năng bổ sung/sửa đổi mới nhất.",
      "coreFeatures là phần MVP bắt buộc; optionalFeatures là phần có thể làm sau.",
      "typeSpecific phải là object có khóa phù hợp loại dự án, ví dụ commands, gameplayLoop, triggers, aiFlow, screens, strategy.",
      "excludedByDesign nêu rõ những thứ không làm để tránh mở rộng phạm vi ngoài yêu cầu."
    ],
    context: {
      rawIdea: input.project.rawIdea,
      mode: input.project.mode,
      sourcePath: input.project.sourcePath,
      intent: input.intent,
      requirements: input.requirements,
      codebaseContext: summarizeCodebaseContext(input.codebaseContext)
    },
    parse: (value) => featureDiscoveryContentSchema.parse(value)
  });
}

export async function runArchitecturePlanProvider(input: {
  project: Project;
  intent: IntentAnalysis;
  requirements: Requirements;
  features: FeatureDiscovery;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderArtifactResult<ArchitecturePlan>> {
  return runStructuredPlanningProvider({
    agentLabel: "Architecture Planner",
    schemaDescription:
      '{"overview":"...","frontend":{"recommended":true,"rationale":"...","stack":["..."]},"backend":{"recommended":false,"rationale":"...","stack":[]},"api":{"recommended":false,"rationale":"...","style":"..."},"database":{"recommended":false,"rationale":"...","options":[]},"runtime":["..."],"integrations":["..."],"risks":["..."]}',
    rules: [
      "frontend/backend/api/database chỉ recommended=true khi có lý do rõ từ ý tưởng, requirements hoặc codebase.",
      "Không mặc định dùng Next.js, API hoặc database nếu dự án không cần.",
      "Nếu đây là yêu cầu phát triển tiếp, ưu tiên mở rộng kiến trúc hiện có thay vì thiết kế lại từ đầu.",
      "Với existing_project, ưu tiên stack/script/framework đang có và nêu rủi ro khi phải đổi stack.",
      "runtime, integrations và risks phải cụ thể theo dự án."
    ],
    context: {
      rawIdea: input.project.rawIdea,
      mode: input.project.mode,
      sourcePath: input.project.sourcePath,
      intent: input.intent,
      requirements: input.requirements,
      features: input.features,
      codebaseContext: summarizeCodebaseContext(input.codebaseContext)
    },
    parse: (value) => {
      const parsed = architecturePlanContentSchema.parse(value);
      return {
        ...parsed,
        frontend: parsed.frontend ? { ...parsed.frontend, stack: parsed.frontend.stack ?? [] } : undefined,
        backend: parsed.backend ? { ...parsed.backend, stack: parsed.backend.stack ?? [] } : undefined
      };
    }
  });
}

export async function runTaskPlanningProvider(input: {
  project: Project;
  intent: IntentAnalysis;
  requirements: Requirements;
  features: FeatureDiscovery;
  architecture: ArchitecturePlan;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderTaskPlanResult> {
  return runWithPreferredProviders({
    codex: () => runCodexTaskPlanningProvider(input),
    gemini: () => runGeminiTaskPlanningProvider(input),
    mock: (reason) => {
      throw new Error(`Không có provider thật để sinh task plan động: ${reason}`);
    }
  });
}

async function runStructuredPlanningProvider<TContent>(input: {
  agentLabel: string;
  schemaDescription: string;
  rules: string[];
  context: unknown;
  parse: (value: unknown) => TContent;
}): Promise<ProviderArtifactResult<TContent>> {
  return runWithPreferredProviders({
    codex: () => runCodexStructuredPlanningProvider(input),
    gemini: () => runGeminiStructuredPlanningProvider(input),
    mock: (reason) => {
      throw new Error(`Không có provider thật cho ${input.agentLabel}: ${reason}`);
    }
  });
}

async function runExecutionPromptForTaskProvider(input: {
  project: Project;
  requirements: Requirements;
  features: FeatureDiscovery;
  architecture: ArchitecturePlan;
  tasks: ProjectTask[];
  task: ProjectTask;
  taskIndex: number;
  totalTasks: number;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderArtifactResult<ExecutionPrompt>> {
  return runStructuredPlanningProvider({
    agentLabel: `Prompt Composer task ${input.taskIndex + 1}/${input.totalTasks}`,
    schemaDescription: '{"taskId":"exact task id","title":"...","prompt":"full Vietnamese execution prompt","reviewChecklist":["..."]}',
    rules: [
      "Chỉ tạo prompt cho đúng một task trong context.task, không tạo prompt cho task khác.",
      "Giữ nguyên taskId.",
      "Prompt phải đủ ngữ cảnh để agent lập trình triển khai riêng task này mà không cần đọc toàn bộ kế hoạch.",
      "Prompt phải nêu rõ ranh giới: làm đúng task hiện tại, không làm sang task trước/sau.",
      "Nếu task phụ thuộc task khác, chỉ nhắc dependency như bối cảnh, không yêu cầu triển khai lại dependency.",
      "Với existing_project, prompt phải nhắc giữ framework/script/quy ước codebase hiện có."
    ],
    context: {
      rawIdea: input.project.rawIdea,
      mode: input.project.mode,
      sourcePath: input.project.sourcePath,
      requirementsSummary: {
        projectName: input.requirements.projectName,
        oneLineSummary: input.requirements.oneLineSummary,
        primaryGoals: input.requirements.primaryGoals,
        constraints: input.requirements.constraints,
        successMetrics: input.requirements.successMetrics
      },
      featureSummary: {
        coreFeatures: input.features.coreFeatures,
        excludedByDesign: input.features.excludedByDesign
      },
      architectureSummary: {
        overview: input.architecture.overview,
        frontend: input.architecture.frontend,
        backend: input.architecture.backend,
        api: input.architecture.api,
        database: input.architecture.database,
        runtime: input.architecture.runtime,
        integrations: input.architecture.integrations
      },
      taskOrder: {
        current: input.taskIndex + 1,
        total: input.totalTasks,
        allTaskTitles: input.tasks.map((task, index) => ({
          order: index + 1,
          taskId: task.id,
          title: task.title,
          taskType: task.taskType
        }))
      },
      task: {
        id: input.task.id,
        title: input.task.title,
        objective: input.task.objective,
        taskType: input.task.taskType,
        targetArea: input.task.targetArea,
        acceptanceCriteria: input.task.acceptanceCriteria,
        dependencies: input.task.dependencies
      },
      codebaseContext: summarizeCodebaseContext(input.codebaseContext)
    },
    parse: (value) => parseExecutionPromptForTask(value, input.task)
  });
}

export async function runExecutionPromptProvider(input: {
  project: Project;
  requirements: Requirements;
  features: FeatureDiscovery;
  architecture: ArchitecturePlan;
  tasks: ProjectTask[];
  codebaseContext?: CodebaseContext;
}): Promise<ProviderArtifactResult<ExecutionPrompt[]>> {
  const chunks: Array<{ provider: string; mode: string; output: string; prompt: ExecutionPrompt }> = [];

  for (let index = 0; index < input.tasks.length; index += 1) {
    const task = input.tasks[index];
    const result = await runExecutionPromptForTaskProvider({
      ...input,
      task,
      taskIndex: index,
      totalTasks: input.tasks.length
    });
    chunks.push({
      provider: result.provider,
      mode: result.mode,
      output: result.output,
      prompt: result.content
    });
  }

  const first = chunks[0];
  return {
    provider: first?.provider ?? "mock",
    mode: first?.mode ?? "none",
    output: chunks
      .map((chunk, index) =>
        [
          `--- Prompt chunk ${index + 1}/${chunks.length}: ${chunk.prompt.title} ---`,
          `Provider: ${chunk.provider} (${chunk.mode})`,
          chunk.output
        ].join("\n")
      )
      .join("\n\n"),
    content: chunks.map((chunk) => chunk.prompt)
  };
}

export async function runFileEditProvider(input: {
  prompt: ExecutionPrompt;
  workspace: string;
  codebaseContext?: CodebaseContext;
  previousError?: string;
}): Promise<ProviderFileEditResult> {
  if (process.env.AI_AGENT_STATIC_FILE_EDITS) {
    const plan = parseFileEditPlan(process.env.AI_AGENT_STATIC_FILE_EDITS);
    return {
      provider: "static",
      mode: "env",
      output: JSON.stringify(plan, null, 2),
      plan
    };
  }

  return runWithPreferredProviders({
    codex: () => runCodexFileEditProvider(input),
    gemini: () => runGeminiFileEditProvider(input),
    mock: (reason) => {
      const plan: FileEditPlan = {
        summary: `Provider mock không đề xuất edit code. ${reason}`,
        edits: []
      };
      return {
        provider: getProviderMode(),
        mode: "mock",
        output: JSON.stringify(plan, null, 2),
        plan
      };
    }
  });
}

async function runWithPreferredProviders<T extends { output: string }>(input: {
  codex: () => Promise<T>;
  gemini: () => Promise<T>;
  mock: (reason: string) => T;
}): Promise<T> {
  if (getProviderMode() === "mock") {
    return input.mock("AI_AGENT_LLM_PROVIDER=mock");
  }

  const codexConfig = getCodexApiConfig();
  let codexFailure = "";

  if (codexConfig) {
    try {
      return await input.codex();
    } catch (error) {
      codexFailure = toErrorMessage(error);
    }
  } else {
    codexFailure = "chưa cấu hình AI_AGENT_CODEX_API_KEY/CODEX_API_KEY/OPENAI_API_KEY";
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const fallback = await input.gemini();
      return withFallbackNotice(fallback, codexFailure);
    } catch (error) {
      const geminiFailure = toErrorMessage(error);
      if (codexConfig) {
        throw new Error(`Codex/OpenAI API không dùng được: ${codexFailure}. Gemini fallback cũng thất bại: ${geminiFailure}`);
      }
      throw new Error(`Gemini provider thất bại: ${geminiFailure}`);
    }
  }

  if (codexConfig) {
    throw new Error(`Codex/OpenAI API không dùng được và chưa cấu hình GEMINI_API_KEY để fallback: ${codexFailure}`);
  }

  return input.mock(codexFailure);
}

function withFallbackNotice<T extends { output: string }>(result: T, reason: string): T {
  return {
    ...result,
    output: [`[Fallback] Codex/OpenAI không dùng được: ${reason}`, result.output].join("\n\n")
  };
}

async function runCodexProvider(prompts: ExecutionPrompt[]): Promise<ProviderExecutionResult> {
  const config = requireCodexApiConfig();
  const input = [
    "Bạn là agent lập trình. Trả về kế hoạch triển khai ngắn gọn và nêu các file sẽ tạo hoặc sửa.",
    "",
    ...prompts.slice(0, 3).map((item, index) => [`Tác vụ ${index + 1}: ${item.title}`, item.prompt].join("\n"))
  ].join("\n\n");

  const data = await callCodexResponsesApi(config, input);

  return {
    provider: "codex-api",
    mode: config.model,
    output: extractResponseText(data)
  };
}

async function runCodexStructuredPlanningProvider<TContent>(input: {
  agentLabel: string;
  schemaDescription: string;
  rules: string[];
  context: unknown;
  parse: (value: unknown) => TContent;
}): Promise<ProviderArtifactResult<TContent>> {
  const config = requireCodexApiConfig();
  const prompt = buildStructuredPlanningPrompt(input);
  const data = await callCodexResponsesApi(config, prompt);
  const output = extractResponseText(data);
  return {
    provider: "codex-api",
    mode: config.model,
    output,
    content: input.parse(parseJsonObject(output))
  };
}

async function runCodexTaskPlanningProvider(input: {
  project: Project;
  intent: IntentAnalysis;
  requirements: Requirements;
  features: FeatureDiscovery;
  architecture: ArchitecturePlan;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderTaskPlanResult> {
  const config = requireCodexApiConfig();
  const prompt = buildTaskPlanningPrompt(input);
  const data = await callCodexResponsesApi(config, prompt);
  const output = extractResponseText(data);
  const plan = parseTaskPlan(output);

  return {
    provider: "codex-api",
    mode: config.model,
    output,
    roadmap: plan.roadmap,
    tasks: plan.tasks
  };
}

async function runCodexFileEditProvider(input: {
  prompt: ExecutionPrompt;
  workspace: string;
  codebaseContext?: CodebaseContext;
  previousError?: string;
}): Promise<ProviderFileEditResult> {
  const config = requireCodexApiConfig();
  const providerInput = [
    "Bạn là agent lập trình.",
    "Phân tích ngắn gọn cách tiếp cận bằng tiếng Việt trước khi đưa kế hoạch sửa file.",
    "Sau phần phân tích, BẮT BUỘC trả về kế hoạch sửa file trong khối ```json",
    "Schema JSON:",
    '{"summary":"short summary","edits":[{"path":"relative/path","action":"create|overwrite|replace|append","content":"full content for create/overwrite/append","oldText":"text to replace","newText":"replacement text"}]}',
    "```",
    "",
    "Quy tắc:",
    "- Đường dẫn phải là tương đối so với workspace.",
    "- Không sửa .git, node_modules, .next, dist, build, coverage hoặc .ai-agent.",
    "- Ưu tiên edit dạng replace hơn overwrite.",
    "- Giữ edit tối thiểu.",
    "",
    `Workspace: ${input.workspace}`,
    input.codebaseContext
      ? [
          `Dấu hiệu framework: ${input.codebaseContext.frameworkSignals.join(", ")}`,
          `Ngôn ngữ: ${input.codebaseContext.languages.join(", ")}`,
          `File quan trọng: ${input.codebaseContext.keyFiles.slice(0, 60).join(", ")}`
        ].join("\n")
      : "Không có ngữ cảnh codebase hiện có.",
    input.previousError ? `Lỗi kiểm chứng trước đó:\n${input.previousError}` : "",
    "",
    "Prompt thực thi:",
    input.prompt.prompt
  ].join("\n");

  const data = await callCodexResponsesApi(config, providerInput);
  const output = extractResponseText(data);

  return {
    provider: "codex-api",
    mode: config.model,
    output,
    plan: parseFileEditPlan(output)
  };
}

async function runGeminiProvider(prompts: ExecutionPrompt[]): Promise<ProviderExecutionResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  const input = [
    ...prompts.slice(0, 3).map((item, index) => [`Tác vụ ${index + 1}: ${item.title}`, item.prompt].join("\n"))
  ].join("\n\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "Bạn là agent lập trình. Trả về kế hoạch triển khai ngắn gọn và nêu các file sẽ tạo hoặc sửa." }]
      },
      contents: [
        {
          parts: [{ text: input }]
        }
      ]
    })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(readProviderError(data, `Gemini provider thất bại với trạng thái ${response.status}`));
  }

  const output = extractGeminiText(data) || "Không có nội dung trả về từ Gemini.";

  return {
    provider: "gemini",
    mode: model,
    output
  };
}

async function runGeminiStructuredPlanningProvider<TContent>(input: {
  agentLabel: string;
  schemaDescription: string;
  rules: string[];
  context: unknown;
  parse: (value: unknown) => TContent;
}): Promise<ProviderArtifactResult<TContent>> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = buildStructuredPlanningPrompt(input);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: `Bạn là ${input.agentLabel}. Chỉ trả về JSON hợp lệ theo schema được yêu cầu.` }]
      },
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(readProviderError(data, `Gemini ${input.agentLabel} thất bại với trạng thái ${response.status}`));
  }

  const output = extractGeminiText(data) || "{}";

  return {
    provider: "gemini",
    mode: model,
    output,
    content: input.parse(parseJsonObject(output))
  };
}

async function runGeminiTaskPlanningProvider(input: {
  project: Project;
  intent: IntentAnalysis;
  requirements: Requirements;
  features: FeatureDiscovery;
  architecture: ArchitecturePlan;
  codebaseContext?: CodebaseContext;
}): Promise<ProviderTaskPlanResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = buildTaskPlanningPrompt(input);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "Bạn là agent chia nhỏ tác vụ. Chỉ trả về JSON hợp lệ theo schema người dùng yêu cầu." }]
      },
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(readProviderError(data, `Gemini task planner thất bại với trạng thái ${response.status}`));
  }

  const output = extractGeminiText(data) || '{"roadmap":[],"tasks":[]}';
  const plan = parseTaskPlan(output);

  return {
    provider: "gemini",
    mode: model,
    output,
    roadmap: plan.roadmap,
    tasks: plan.tasks
  };
}

async function runGeminiFileEditProvider(input: {
  prompt: ExecutionPrompt;
  workspace: string;
  codebaseContext?: CodebaseContext;
  previousError?: string;
}): Promise<ProviderFileEditResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = [
    "Bạn là agent lập trình.",
    "Phân tích ngắn gọn cách tiếp cận bằng tiếng Việt trước khi đưa kế hoạch sửa file.",
    "Sau phần phân tích, BẮT BUỘC trả về kế hoạch sửa file trong khối ```json",
    "Schema JSON:",
    '{"summary":"short summary","edits":[{"path":"relative/path","action":"create|overwrite|replace|append","content":"full content for create/overwrite/append","oldText":"text to replace","newText":"replacement text"}]}',
    "```",
    "",
    "Quy tắc:",
    "- Đường dẫn phải là tương đối so với workspace.",
    "- Không sửa .git, node_modules, .next, dist, build, coverage hoặc .ai-agent.",
    "- Ưu tiên edit dạng replace hơn overwrite.",
    "- Giữ edit tối thiểu."
  ].join("\n");

  const userPrompt = [
    `Workspace: ${input.workspace}`,
    input.codebaseContext
      ? [
          `Dấu hiệu framework: ${input.codebaseContext.frameworkSignals.join(", ")}`,
          `Ngôn ngữ: ${input.codebaseContext.languages.join(", ")}`,
          `File quan trọng: ${input.codebaseContext.keyFiles.slice(0, 60).join(", ")}`
        ].join("\n")
      : "Không có ngữ cảnh codebase hiện có.",
    input.previousError ? `Lỗi kiểm chứng trước đó:\n${input.previousError}` : "",
    "",
    "Prompt thực thi:",
    input.prompt.prompt
  ].join("\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          parts: [{ text: userPrompt }]
        }
      ]
    })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(readProviderError(data, `Gemini file edit provider thất bại với trạng thái ${response.status}`));
  }

  const output = extractGeminiText(data) || '{"summary":"Empty response","edits":[]}';

  return {
    provider: "gemini",
    mode: model,
    output,
    plan: parseFileEditPlan(output)
  };
}

async function callCodexResponsesApi(config: CodexApiConfig, input: string) {
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input
    })
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(readProviderError(data, `Codex/OpenAI API thất bại với trạng thái ${response.status}`));
  }

  return data;
}

function buildTaskPlanningPrompt(input: {
  project: Project;
  intent: IntentAnalysis;
  requirements: Requirements;
  features: FeatureDiscovery;
  architecture: ArchitecturePlan;
  codebaseContext?: CodebaseContext;
}) {
  return [
    "Bạn là Agent chia nhỏ tác vụ cho hệ thống AI Agent tổng quát.",
    "Hãy phân tích ý tưởng người dùng và các tài liệu đã có để tạo task plan động, không dùng template phase cố định.",
    "",
    "Chỉ trả về JSON trong khối ```json theo schema:",
    '{"roadmap":[{"title":"...","objective":"...","deliverables":["..."],"exitCriteria":["..."]}],"tasks":[{"title":"...","objective":"...","taskType":"snake_case","targetArea":"...","acceptanceCriteria":["..."],"dependencies":["optional taskType"]}]}',
    "",
    "Quy tắc:",
    "- Sinh 3-7 tác vụ có ý nghĩa theo đúng ý tưởng, loại dự án, feature và kiến trúc.",
    "- Nếu rawIdea có 'Yêu cầu phát triển tiếp', task plan phải tập trung vào phần mới cần phát triển, không lập lại toàn bộ dự án từ đầu.",
    "- Không tạo chuỗi phase cứng như khởi tạo file/types/mock/static/data-access/edge-case cho mọi dự án.",
    "- Không mặc định có web UI, API, auth hoặc database nếu tài liệu kiến trúc không khuyến nghị.",
    "- Nếu có codebase_context, tác vụ đầu nên chỉ rõ vùng codebase cần rà soát/thay đổi.",
    "- Mỗi acceptanceCriteria phải kiểm chứng được.",
    "- taskType dùng snake_case ngắn, ổn định.",
    "",
    "Dữ liệu đầu vào:",
    JSON.stringify(
      {
        rawIdea: input.project.rawIdea,
        mode: input.project.mode,
        sourcePath: input.project.sourcePath,
        intent: input.intent,
        requirements: input.requirements,
        features: input.features,
        architecture: input.architecture,
        codebaseContext: input.codebaseContext
          ? {
              sourcePath: input.codebaseContext.sourcePath,
              frameworkSignals: input.codebaseContext.frameworkSignals,
              languages: input.codebaseContext.languages,
              packageManager: input.codebaseContext.packageManager,
              keyFiles: input.codebaseContext.keyFiles.slice(0, 40),
              detectedCommands: input.codebaseContext.detectedCommands
            }
          : undefined
      },
      null,
      2
    )
  ].join("\n");
}

function buildStructuredPlanningPrompt(input: {
  agentLabel: string;
  schemaDescription: string;
  rules: string[];
  context: unknown;
}) {
  return [
    `Bạn là ${input.agentLabel} trong hệ thống AI Agent tổng quát.`,
    "Hãy phân tích dữ liệu đầu vào bằng AI và sinh đúng tài liệu blueprint theo ngữ cảnh.",
    "",
    "Chỉ trả về JSON trong khối ```json, không thêm markdown ngoài khối JSON.",
    "Schema:",
    input.schemaDescription,
    "",
    "Quy tắc:",
    ...input.rules.map((rule) => `- ${rule}`),
    "- Viết nội dung bằng tiếng Việt tự nhiên, cụ thể, tránh câu chung chung.",
    "- Không dùng dữ liệu mẫu cố định nếu không có trong ý tưởng hoặc codebase.",
    "",
    "Dữ liệu đầu vào:",
    JSON.stringify(input.context, null, 2)
  ].join("\n");
}

function parseTaskPlan(output: string): { roadmap: RoadmapMilestone[]; tasks: TaskDraft[] } {
  const parsed = parseJsonObject(output) as {
    roadmap?: unknown[];
    tasks?: unknown[];
  };

  const roadmap = Array.isArray(parsed.roadmap)
    ? parsed.roadmap.slice(0, 6).map((item) => normalizeRoadmapItem(item)).filter(Boolean)
    : [];
  const tasks = Array.isArray(parsed.tasks)
    ? parsed.tasks.slice(0, 10).map((item, index) => normalizeTaskItem(item, index)).filter(Boolean)
    : [];

  if (!roadmap.length || !tasks.length) {
    throw new Error("Provider không trả về roadmap/tasks hợp lệ.");
  }

  return {
    roadmap: roadmap as RoadmapMilestone[],
    tasks: tasks as TaskDraft[]
  };
}

function parseExecutionPromptPlan(value: unknown, tasks: ProjectTask[]): ExecutionPrompt[] {
  if (!isRecord(value) || !Array.isArray(value.prompts)) {
    throw new Error("Provider không trả về prompts hợp lệ.");
  }
  const rawPrompts = value.prompts;

  const prompts = tasks.map((task, index) => {
    const source =
      rawPrompts.find((item) => isRecord(item) && readString(item.taskId) === task.id) ??
      rawPrompts[index];
    if (!isRecord(source)) {
      throw new Error(`Thiếu prompt cho task ${task.title}.`);
    }
    return executionPromptContentSchema.parse({
      taskId: task.id,
      title: readString(source.title) || task.title,
      prompt: readString(source.prompt),
      reviewChecklist: readStringArray(source.reviewChecklist, [
        "Kết quả bám sát task đã duyệt.",
        "Tiêu chí nghiệm thu được đáp ứng.",
        "Không thêm phạm vi ngoài kế hoạch."
      ])
    });
  });

  if (prompts.some((prompt) => !prompt.prompt.trim())) {
    throw new Error("Một hoặc nhiều prompt thực thi bị rỗng.");
  }

  return prompts;
}

function parseExecutionPromptForTask(value: unknown, task: ProjectTask): ExecutionPrompt {
  if (!isRecord(value)) {
    throw new Error(`Provider không trả về prompt hợp lệ cho task ${task.title}.`);
  }

  const prompt = executionPromptContentSchema.parse({
    taskId: task.id,
    title: readString(value.title) || task.title,
    prompt: readString(value.prompt),
    reviewChecklist: readStringArray(value.reviewChecklist, [
      "Kết quả bám sát task đã duyệt.",
      "Tiêu chí nghiệm thu được đáp ứng.",
      "Không thêm phạm vi ngoài kế hoạch."
    ])
  });

  if (!prompt.prompt.trim()) {
    throw new Error(`Prompt thực thi bị rỗng cho task ${task.title}.`);
  }

  return prompt;
}

function normalizeRoadmapItem(value: unknown): RoadmapMilestone | undefined {
  if (!isRecord(value)) return undefined;
  const title = readString(value.title);
  const objective = readString(value.objective);
  if (!title || !objective) return undefined;
  return {
    id: readString(value.id) || createId(),
    title,
    objective,
    deliverables: readStringArray(value.deliverables, ["Mốc hoàn thành có đầu ra rõ ràng"]),
    exitCriteria: readStringArray(value.exitCriteria, ["Có thể review và chuyển sang bước tiếp theo"])
  };
}

function normalizeTaskItem(value: unknown, index: number): TaskDraft | undefined {
  if (!isRecord(value)) return undefined;
  const title = readString(value.title);
  const objective = readString(value.objective);
  if (!title || !objective) return undefined;
  const taskType = toSnakeCase(readString(value.taskType) || title);
  return {
    id: readString(value.id) || createId(),
    title,
    objective,
    taskType,
    targetArea: readString(value.targetArea) || taskType,
    acceptanceCriteria: readStringArray(value.acceptanceCriteria, ["Tác vụ đáp ứng đúng mục tiêu đã mô tả."]),
    dependencies: readStringArray(value.dependencies),
    status: "pending",
    priority: index + 1
  };
}

function parseFileEditPlan(output: string): FileEditPlan {
  try {
    const parsed = parseJsonObject(output) as Partial<FileEditPlan>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "Không có tóm tắt",
      edits: Array.isArray(parsed.edits) ? parsed.edits : []
    };
  } catch (err) {
    return {
      summary: "Lỗi parse JSON: " + (err instanceof Error ? err.message : String(err)),
      edits: []
    };
  }
}

function parseJsonObject(output: string): Record<string, unknown> {
  let cleaned = output;
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  } else {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = output.slice(start, end + 1);
    }
  }
  const parsed = JSON.parse(cleaned) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("JSON root không phải object.");
  }
  return parsed;
}

function getProviderMode() {
  return (process.env.AI_AGENT_LLM_PROVIDER || "auto").trim().toLowerCase();
}

function requireCodexApiConfig() {
  const config = getCodexApiConfig();
  if (!config) {
    throw new Error("Thiếu AI_AGENT_CODEX_API_KEY/CODEX_API_KEY/OPENAI_API_KEY.");
  }
  return config;
}

function getCodexApiConfig(): CodexApiConfig | undefined {
  const apiKey = firstEnv(["AI_AGENT_CODEX_API_KEY", "CODEX_API_KEY", "OPENAI_API_KEY"]);
  if (!apiKey) return undefined;
  return {
    apiKey,
    baseUrl: (firstEnv(["AI_AGENT_CODEX_API_BASE_URL", "CODEX_API_BASE_URL", "OPENAI_BASE_URL"]) || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: firstEnv(["AI_AGENT_CODEX_API_MODEL", "CODEX_MODEL", "OPENAI_MODEL"]) || "gpt-5.4-mini"
  };
}

function firstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function readProviderError(data: unknown, fallback: string) {
  if (isRecord(data)) {
    const error = data.error;
    if (isRecord(error) && typeof error.message === "string") return error.message;
    if (typeof data.raw === "string" && data.raw.trim()) return data.raw.trim();
  }
  return fallback;
}

function extractResponseText(data: unknown) {
  if (isRecord(data) && typeof data.output_text === "string") return data.output_text;

  const chunks: string[] = [];
  if (isRecord(data) && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!isRecord(item) || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (isRecord(content) && typeof content.text === "string") chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("\n").trim();
  return text || JSON.stringify(data);
}

function extractGeminiText(data: unknown) {
  if (!isRecord(data) || !Array.isArray(data.candidates)) return "";
  const [candidate] = data.candidates;
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) return "";
  return candidate.content.parts
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => readString(item)).filter(Boolean);
  return items.length ? items : fallback;
}

function summarizeCodebaseContext(context?: CodebaseContext) {
  if (!context) return undefined;
  return {
    sourcePath: context.sourcePath,
    rootName: context.rootName,
    packageManager: context.packageManager,
    frameworkSignals: context.frameworkSignals,
    languages: context.languages,
    scripts: context.scripts,
    dependencies: context.dependencies.slice(0, 40),
    devDependencies: context.devDependencies.slice(0, 40),
    keyFiles: context.keyFiles.slice(0, 60),
    detectedCommands: context.detectedCommands,
    risks: context.risks
  };
}

function toSnakeCase(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "project_task";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
