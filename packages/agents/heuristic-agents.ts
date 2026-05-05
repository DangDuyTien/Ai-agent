import type {
  ArchitecturePlan,
  CodebaseContext,
  ExecutionPrompt,
  FeatureDiscovery,
  IntentAnalysis,
  Project,
  ProjectTask,
  ProjectType,
  Requirements,
  RoadmapMilestone
} from "@/packages/schemas/project-blueprint.schema";
import { createId } from "@/lib/store";

type TaskDraft = Omit<ProjectTask, "projectId" | "createdAt" | "updatedAt">;

const projectTypeKeywords: Record<ProjectType, string[]> = {
  trading_bot: [
    "trading bot",
    "trade bot",
    "crypto",
    "forex",
    "binance",
    "exchange",
    "backtest",
    "risk",
    "strategy",
    "chiến lược giao dịch",
    "giao dịch tự động"
  ],
  game: ["game", "tro choi", "gameplay", "level", "scene", "player", "score", "asset", "nhan vat"],
  bot: ["bot", "telegram", "discord", "slack", "zalo", "command", "event", "message", "chat bot"],
  automation_tool: [
    "automation",
    "tự động",
    "workflow",
    "trigger",
    "schedule",
    "cron",
    "zapier",
    "make.com",
    "email report",
    "dong bo",
    "lay du lieu"
  ],
  mobile_app: ["mobile", "ios", "android", "react native", "flutter", "app dien thoai", "smartphone"],
  saas: ["saas", "subscription", "tenant", "multi tenant", "billing", "workspace", "team", "gói dịch vụ"],
  landing_page: ["landing page", "sales page", "cta", "conversion", "lead", "marketing page", "trang giới thiệu"],
  ai_tool: ["ai tool", "llm", "prompt", "generate", "summarize", "phân tích bằng ai", "rag", "embedding"],
  web_app: ["web app", "website", "dashboard", "admin", "portal", "quản lý", "trình duyệt"],
  unknown: []
};

const typeLabels: Record<ProjectType, string> = {
  web_app: "ứng dụng web",
  mobile_app: "ứng dụng di động",
  saas: "SaaS",
  bot: "bot",
  automation_tool: "công cụ tự động hóa",
  game: "trò chơi",
  ai_tool: "công cụ AI",
  trading_bot: "bot giao dịch",
  landing_page: "landing page",
  unknown: "dự án chưa rõ loại"
};

export function runIntentAnalyzer(project: Project): IntentAnalysis {
  const normalized = normalize(project.rawIdea);
  const scores = Object.entries(projectTypeKeywords)
    .filter(([type]) => type !== "unknown")
    .map(([type, keywords]) => {
      const matched = keywords.filter((keyword) => normalized.includes(normalize(keyword)));
      return {
        type: type as ProjectType,
        score: matched.length,
        matched
      };
    })
    .sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const projectType: ProjectType = winner && winner.score > 0 ? winner.type : inferFallbackType(normalized);
  const confidence = winner && winner.score > 0 ? Math.min(0.95, 0.55 + winner.score * 0.12) : 0.42;
  const missingQuestions = buildMissingQuestions(projectType, normalized);
  const targetPlatforms = inferPlatforms(projectType, normalized);
  const signals = winner?.matched ?? [];

  return {
    projectType,
    confidence,
    reasoning:
      projectType === "unknown"
        ? "Ý tưởng hiện chưa có đủ tín hiệu để phân loại chắc chắn, nên hệ thống cần giữ blueprint mở và hỏi thêm thông tin tối thiểu."
        : `Ý tưởng có tín hiệu phù hợp với ${typeLabels[projectType]}: ${signals.slice(0, 5).join(", ") || "ngữ cảnh tổng quát"}.`,
    targetPlatforms,
    missingQuestions,
    initialAssumptions: buildInitialAssumptions(projectType, normalized),
    signals
  };
}

export function runRequirementBuilder(project: Project, intent: IntentAnalysis): Requirements {
  const projectName = project.name || titleForType(intent.projectType);
  const summary = buildSummary(project.rawIdea, intent.projectType);
  const targetUsers = inferTargetUsers(project.rawIdea, intent.projectType);

  return {
    projectName,
    oneLineSummary: summary,
    targetUsers,
    problemStatement: buildProblemStatement(project.rawIdea, intent.projectType),
    primaryGoals: buildPrimaryGoals(intent.projectType),
    nonGoals: [
      "Không mặc định cần API, database hoặc xác thực nếu loại dự án không đòi hỏi.",
      "Không ép blueprint thành CRUD cố định.",
      "Không thực thi code trước khi người dùng duyệt các tài liệu chính."
    ],
    constraints: [
      "Mọi đề xuất phải dựa trên ngữ cảnh ý tưởng và loại dự án đã nhận diện.",
      "Nếu thiếu thông tin quan trọng, agent chỉ hỏi tối đa 2-3 câu ưu tiên cao.",
      "Các tài liệu cần có phiên bản để người dùng có thể sửa và duyệt trước khi thực thi."
    ],
    successMetrics: buildSuccessMetrics(intent.projectType)
  };
}

export function runFeatureDiscovery(project: Project, intent: IntentAnalysis, requirements: Requirements): FeatureDiscovery {
  const normalized = normalize(project.rawIdea);
  const persistenceNeeded = needsPersistence(normalized, intent.projectType);
  const accountNeeded = needsAccounts(normalized, intent.projectType);

  const sharedCore = [
    "Blueprint dự án động theo ngữ cảnh",
    "Cổng duyệt trước các bước có tác động lớn",
    "Nhật ký agent theo thời gian"
  ];

  const byType = featurePackForType(intent.projectType, {
    persistenceNeeded,
    accountNeeded,
    rawIdea: project.rawIdea,
    requirements
  });

  return {
    coreFeatures: [...sharedCore, ...byType.coreFeatures],
    optionalFeatures: byType.optionalFeatures,
    typeSpecific: byType.typeSpecific,
    excludedByDesign: [
      persistenceNeeded ? "Không tạo database schema nghiệp vụ cố định ngoài blueprint/tài liệu/tác vụ/log." : "Không thêm database ứng dụng nếu chưa có nhu cầu lưu trạng thái.",
      accountNeeded ? "Xác thực chỉ nên phục vụ vai trò người dùng thật." : "Không thêm xác thực nếu MVP một người dùng đã đủ."
    ]
  };
}

export function runArchitecturePlanner(
  project: Project,
  intent: IntentAnalysis,
  features: FeatureDiscovery
): ArchitecturePlan {
  const normalized = normalize(project.rawIdea);
  const persistenceNeeded = needsPersistence(normalized, intent.projectType);
  const accountNeeded = needsAccounts(normalized, intent.projectType);
  const integrationNeeded = needsIntegration(normalized, intent.projectType);

  switch (intent.projectType) {
    case "mobile_app":
      return {
        overview: "Kiến trúc ưu tiên luồng mobile, trạng thái màn hình và offline-first nếu cần; API chỉ xuất hiện khi cần đồng bộ hoặc backend chung.",
        frontend: {
          recommended: true,
          rationale: "Ứng dụng di động cần UI/luồng màn hình riêng trên thiết bị.",
          stack: ["React Native + Expo", "NativeWind hoặc StyleSheet", "Expo Router"]
        },
        backend: {
          recommended: persistenceNeeded || accountNeeded || integrationNeeded,
          rationale: persistenceNeeded || accountNeeded || integrationNeeded ? "Cần backend cho đồng bộ, xác thực hoặc tích hợp ngoài." : "MVP có thể chạy local/offline trước.",
          stack: ["Node.js/NestJS hoặc Supabase Edge Functions"]
        },
        api: {
          recommended: persistenceNeeded || integrationNeeded,
          rationale: "API chỉ cần khi ứng dụng di động cần đồng bộ dữ liệu hoặc gọi dịch vụ ngoài.",
          style: "REST hoặc tRPC"
        },
        database: {
          recommended: persistenceNeeded,
          rationale: persistenceNeeded ? "Cần lưu dữ liệu người dùng, lịch sử hoặc cấu hình." : "Chưa cần database nếu chỉ là prototype offline.",
          options: persistenceNeeded ? ["PostgreSQL", "SQLite local", "Supabase"] : []
        },
        runtime: ["Runtime di động", "CI build preview"],
        integrations: inferIntegrations(project.rawIdea),
        risks: ["Khác biệt iOS/Android", "Quyền thiết bị", "Đồng bộ offline nếu có"]
      };
    case "bot":
      return {
        overview: "Kiến trúc bot tập trung vào command, event handler, quyền và luồng tin nhắn.",
        backend: {
          recommended: true,
          rationale: "Bot cần runtime để lắng nghe event/message từ nền tảng.",
          stack: ["Node.js", "Platform SDK", "Queue nhẹ nếu có job dài"]
        },
        api: {
          recommended: true,
          rationale: "Webhook hoặc long polling tùy nền tảng.",
          style: "Webhook"
        },
        database: {
          recommended: persistenceNeeded,
          rationale: persistenceNeeded ? "Cần lưu cấu hình server/user, session hoặc log." : "Bot đơn giản có thể dùng file cấu hình/env.",
          options: persistenceNeeded ? ["PostgreSQL", "SQLite", "Redis cho state ngắn hạn"] : []
        },
        runtime: ["Worker process", "Webhook endpoint", "Secret/env management"],
        integrations: inferIntegrations(project.rawIdea),
        risks: ["Rate limit của nền tảng", "Phạm vi quyền", "Xử lý retry khi webhook lỗi"]
      };
    case "game":
      return {
        overview: "Kiến trúc game ưu tiên gameplay loop, state, scene, asset pipeline và xử lý input.",
        frontend: {
          recommended: true,
          rationale: "Game cần lớp render và input trên client.",
          stack: ["Phaser hoặc Canvas/WebGL", "TypeScript", "Vite"]
        },
        backend: {
          recommended: /multiplayer|leaderboard|online/.test(normalized),
          rationale: /multiplayer|leaderboard|online/.test(normalized) ? "Cần backend cho leaderboard/multiplayer." : "Game nhỏ single-player không cần backend.",
          stack: ["Node.js WebSocket server"]
        },
        api: {
          recommended: /leaderboard|account|score/.test(normalized),
          rationale: "API chỉ cần khi cần lưu điểm, leaderboard hoặc profile online.",
          style: "REST/WebSocket"
        },
        database: {
          recommended: /leaderboard|account|score/.test(normalized),
          rationale: /leaderboard|account|score/.test(normalized) ? "Cần lưu score/player profile." : "Không cần database cho gameplay local.",
          options: /leaderboard|account|score/.test(normalized) ? ["SQLite", "PostgreSQL"] : []
        },
        runtime: ["Browser game runtime", "Asset pipeline", "Build static"],
        integrations: [],
        risks: ["Cân bằng gameplay", "Hiệu năng render", "Quản lý asset"]
      };
    case "automation_tool":
      return {
        overview: "Kiến trúc tự động hóa tập trung vào trigger, action, tích hợp, retry và audit log.",
        backend: {
          recommended: true,
          rationale: "Automation cần runtime để chạy trigger, scheduler hoặc webhook.",
          stack: ["Node.js worker", "BullMQ/Redis nếu cần queue", "Cron/Webhook"]
        },
        api: {
          recommended: integrationNeeded,
          rationale: integrationNeeded ? "Cần endpoint để nhận webhook hoặc kết nối dịch vụ ngoài." : "Cron local có thể không cần public API.",
          style: "Webhook/REST"
        },
        database: {
          recommended: persistenceNeeded || integrationNeeded,
          rationale: persistenceNeeded || integrationNeeded ? "Cần lưu cấu hình workflow, lần chạy, token và audit log." : "Script automation đơn giản có thể dùng file cấu hình.",
          options: persistenceNeeded || integrationNeeded ? ["PostgreSQL", "SQLite", "Redis cho queue"] : []
        },
        runtime: ["Worker", "Scheduler", "Retry policy", "Structured logs"],
        integrations: inferIntegrations(project.rawIdea),
        risks: ["Xử lý token/secret", "Idempotency", "Retry tạo action trùng lặp"]
      };
    case "landing_page":
      return {
        overview: "Kiến trúc landing page ưu tiên nội dung, CTA, tracking và tốc độ tải trang; backend/database chỉ thêm nếu có form hoặc cá nhân hóa.",
        frontend: {
          recommended: true,
          rationale: "Landing page là trải nghiệm giao diện và chuyển đổi.",
          stack: ["Next.js static route", "CSS modules hoặc Tailwind", "Analytics"]
        },
        backend: {
          recommended: /form|lead|email|booking|payment/.test(normalized),
          rationale: /form|lead|email|booking|payment/.test(normalized) ? "Cần backend nhẹ để nhận lead/form." : "Static page là đủ cho MVP.",
          stack: ["Next.js route handler"]
        },
        api: {
          recommended: /form|lead|email|booking/.test(normalized),
          rationale: "API chỉ cần để gửi lead/contact.",
          style: "Form endpoint"
        },
        database: {
          recommended: /lead|booking|signup/.test(normalized),
          rationale: /lead|booking|signup/.test(normalized) ? "Cần lưu lead/signup." : "Không cần DB nếu CTA đi tới kênh ngoài.",
          options: /lead|booking|signup/.test(normalized) ? ["PostgreSQL", "Airtable", "Google Sheet"] : []
        },
        runtime: ["Static hosting", "Image optimization", "Analytics"],
        integrations: inferIntegrations(project.rawIdea),
        risks: ["Nội dung chưa rõ offer", "CTA yếu", "Core Web Vitals"]
      };
    case "trading_bot":
      return {
        overview: "Kiến trúc bot giao dịch phải tách chiến lược, data feed, backtest, kiểm soát rủi ro và execution adapter.",
        backend: {
          recommended: true,
          rationale: "Bot giao dịch cần runtime liên tục, quản lý data feed và lệnh.",
          stack: ["Python hoặc Node.js", "Exchange SDK", "Backtesting engine"]
        },
        api: {
          recommended: /dashboard|remote|webhook/.test(normalized),
          rationale: "API chỉ cần nếu điều khiển từ dashboard/webhook.",
          style: "REST/WebSocket"
        },
        database: {
          recommended: true,
          rationale: "Cần lưu candles, signals, orders, positions, audit log và kết quả backtest.",
          options: ["PostgreSQL", "TimescaleDB", "SQLite cho local backtest"]
        },
        runtime: ["Strategy engine", "Risk guard", "Paper trading", "Backtest runner"],
        integrations: inferIntegrations(project.rawIdea),
        risks: ["Mất tiền thật nếu không có giới hạn rủi ro", "Chất lượng dữ liệu", "Độ trễ và sự cố sàn giao dịch"]
      };
    case "ai_tool":
      return {
        overview: "Kiến trúc công cụ AI tập trung vào hợp đồng input/output, chuỗi prompt, model provider, đánh giá và guardrail.",
        frontend: {
          recommended: /dashboard|web|ui|upload|form/.test(normalized),
          rationale: /dashboard|web|ui|upload|form/.test(normalized) ? "Cần UI để người dùng nhập input và xem output." : "Có thể bắt đầu bằng CLI nếu là workflow nội bộ.",
          stack: ["Next.js", "React", "Streaming UI nếu cần"]
        },
        backend: {
          recommended: true,
          rationale: "Nên có backend để giữ API key, prompt template, logging và guardrail.",
          stack: ["Node.js route handlers", "LLM provider adapter", "Eval runner"]
        },
        api: {
          recommended: true,
          rationale: "Cần endpoint trung gian giữa UI/CLI và model provider.",
          style: "REST/streaming"
        },
        database: {
          recommended: persistenceNeeded,
          rationale: persistenceNeeded ? "Cần lưu prompt, lịch sử, feedback hoặc knowledge base." : "MVP có thể không lưu lịch sử.",
          options: persistenceNeeded ? ["PostgreSQL JSONB", "Vector store nếu có RAG"] : []
        },
        runtime: ["Chuỗi prompt", "Adapter provider", "Checklist đánh giá", "Bộ lọc an toàn"],
        integrations: inferIntegrations(project.rawIdea),
        risks: ["Prompt lệch ngữ cảnh", "Chi phí model", "Output không ổn định"]
      };
    case "saas":
    case "web_app":
    case "unknown":
    default:
      return {
        overview:
          intent.projectType === "unknown"
            ? "Kiến trúc giữ mở: bắt đầu bằng blueprint và prototype tối thiểu, chỉ thêm web/backend/database khi đã có nhu cầu rõ."
            : "Kiến trúc web/SaaS chỉ thêm backend, API và database khi có user state, xác thực, payment, collaboration hoặc reporting.",
        frontend: {
          recommended: intent.projectType !== "unknown",
          rationale: intent.projectType !== "unknown" ? "Cần dashboard/UI để người dùng thực hiện workflow chính." : "Chưa chắc cần UI cho tới khi làm rõ xong.",
          stack: intent.projectType !== "unknown" ? ["Next.js", "React", "TypeScript"] : []
        },
        backend: {
          recommended: persistenceNeeded || accountNeeded || integrationNeeded || intent.projectType === "saas",
          rationale:
            persistenceNeeded || accountNeeded || integrationNeeded || intent.projectType === "saas"
              ? "Cần backend cho state, xác thực, tích hợp, billing hoặc business logic."
              : "Web app tĩnh/one-off có thể không cần backend lúc đầu.",
          stack: ["Next.js route handlers", "Node.js services"]
        },
        api: {
          recommended: persistenceNeeded || integrationNeeded || intent.projectType === "saas",
          rationale: "API cần khi frontend phải đọc/ghi state hoặc nối với dịch vụ ngoài.",
          style: "REST hoặc server actions"
        },
        database: {
          recommended: persistenceNeeded || accountNeeded || intent.projectType === "saas",
          rationale:
            persistenceNeeded || accountNeeded || intent.projectType === "saas"
              ? "Cần lưu người dùng, workspace, tài liệu, audit log hoặc subscription."
              : "Không cần DB cho static/prototype không có state.",
          options: persistenceNeeded || accountNeeded || intent.projectType === "saas" ? ["PostgreSQL", "Prisma/Drizzle", "JSONB cho tài liệu động"] : []
        },
        runtime: ["Runtime ứng dụng", "Điều phối agent", "Log có cấu trúc"],
        integrations: inferIntegrations(project.rawIdea),
        risks: ["Cần chốt ranh giới phạm vi trong cổng duyệt trước khi thực thi", "Schema tài liệu quá cứng", "Thiếu cổng duyệt trước khi thực thi"]
      };
  }
}

export function runTaskDecomposer(
  project: Project,
  intent: IntentAnalysis,
  requirements: Requirements,
  features: FeatureDiscovery,
  architecture: ArchitecturePlan
): { roadmap: RoadmapMilestone[]; tasks: TaskDraft[] } {
  const roadmap = buildRoadmap(intent.projectType, features, architecture);
  const tasks = buildTasks(project, intent, requirements, features, architecture, roadmap);
  return { roadmap, tasks };
}

export function runPromptComposer(
  project: Project,
  requirements: Requirements,
  features: FeatureDiscovery,
  architecture: ArchitecturePlan,
  tasks: ProjectTask[],
  codebaseContext?: CodebaseContext
): ExecutionPrompt[] {
  return tasks.map((task) => {
    const prompt = [
      `Bạn là agent lập trình AI đang làm việc trên: ${project.name}.`,
      "",
      "Ngữ cảnh dự án:",
      `- Ý tưởng thô: ${project.rawIdea}`,
      `- Tóm tắt: ${requirements.oneLineSummary}`,
      `- Người dùng mục tiêu: ${requirements.targetUsers.join(", ")}`,
      `- Vấn đề: ${requirements.problemStatement}`,
      `- Tổng quan kiến trúc: ${architecture.overview}`,
      `- Chức năng cốt lõi: ${features.coreFeatures.join("; ")}`,
      ...(codebaseContext
        ? [
            "",
            "Ngữ cảnh codebase có sẵn:",
            `- Đường dẫn nguồn: ${codebaseContext.sourcePath}`,
            `- Dấu hiệu framework: ${codebaseContext.frameworkSignals.join(", ") || "chưa rõ"}`,
            `- Ngôn ngữ: ${codebaseContext.languages.join(", ") || "chưa rõ"}`,
            `- Trình quản lý gói: ${codebaseContext.packageManager || "chưa rõ"}`,
            `- Script: ${Object.keys(codebaseContext.scripts).join(", ") || "không có"}`,
            `- File quan trọng: ${codebaseContext.keyFiles.slice(0, 30).join(", ") || "không có"}`
          ]
        : []),
      "",
      "Tác vụ:",
      `- Tiêu đề: ${task.title}`,
      `- Mục tiêu: ${task.objective}`,
      `- Vùng tác động: ${task.targetArea}`,
      `- Loại tác vụ: ${task.taskType}`,
      "",
      "Ràng buộc:",
      "- Không giả định mọi dự án đều cần web UI, API, xác thực hoặc database.",
      "- Giữ triển khai khớp với loại dự án đã nhận diện và tiêu chí nghiệm thu của tác vụ.",
      "- Tránh refactor không liên quan và tránh tạo module CRUD cố định nếu blueprint không yêu cầu rõ.",
      ...(codebaseContext
        ? [
            "- Giữ cấu trúc dự án, framework, trình quản lý gói và quy ước cục bộ đang có.",
            "- Ưu tiên diff nhỏ trong codebase hiện có và chạy các lệnh kiểm chứng đã phát hiện khi có thể."
          ]
        : []),
      "",
      "Tiêu chí nghiệm thu:",
      ...task.acceptanceCriteria.map((item) => `- ${item}`),
      "",
      "Đầu ra mong đợi:",
      "1. Suy nghĩ từng bước (Chain of Thought): Phân tích file nào cần tạo/sửa, mục tiêu là gì, dữ liệu đầu vào/đầu ra ra sao trước khi viết code.",
      "2. Triển khai tập file NHỎ NHẤT có thể để hoàn thành riêng nhiệm vụ vi mô này. KHÔNG làm lố sang phạm vi của nhiệm vụ khác.",
      "3. Trả về chính xác các file đã sửa/tạo và giải thích ngắn gọn.",
      "4. Nếu yêu cầu còn mơ hồ, nêu giả định cụ thể trước khi code."
    ].join("\n");

    return {
      taskId: task.id,
      title: task.title,
      prompt,
      reviewChecklist: [
        "Kết quả bám sát loại dự án và không ép thành web/API/DB nếu không cần.",
        "Mục tiêu tác vụ và tiêu chí nghiệm thu đã được đáp ứng.",
        "Code hoặc tài liệu có thể review/chạy lại được.",
        "Không thêm phạm vi ngoài roadmap đã duyệt."
      ]
    };
  });
}

function featurePackForType(
  projectType: ProjectType,
  context: {
    persistenceNeeded: boolean;
    accountNeeded: boolean;
    rawIdea: string;
    requirements: Requirements;
  }
): Pick<FeatureDiscovery, "coreFeatures" | "optionalFeatures" | "typeSpecific"> {
  const { persistenceNeeded, accountNeeded, rawIdea } = context;
  const normalized = normalize(rawIdea);

  if (projectType === "mobile_app") {
    return {
      coreFeatures: ["Luồng màn hình di động", "Chiến lược local state/storage", "Sơ đồ điều hướng"],
      optionalFeatures: ["Thông báo đẩy", "Đồng bộ offline", "Luồng quyền thiết bị"],
      typeSpecific: {
        screens: ["Onboarding", "Main workflow", "Detail/result screen", "Settings"],
        storage: persistenceNeeded ? ["cache cục bộ", "đồng bộ từ xa"] : ["chỉ dùng local state"],
        apiIfNeeded: persistenceNeeded || accountNeeded
      }
    };
  }

  if (projectType === "bot") {
    return {
      coreFeatures: ["Thiết kế command/event", "Mô hình quyền", "Luồng phản hồi/lỗi"],
      optionalFeatures: ["Command quản trị", "Tin nhắn theo lịch", "Trạng thái hội thoại"],
      typeSpecific: {
        commands: inferBotCommands(normalized),
        events: ["nhận tin nhắn", "gọi command", "bị từ chối quyền", "webhook bên ngoài"],
        automationFlows: ["phân tích input", "kiểm tra quyền", "thực thi hành động", "gửi phản hồi"]
      }
    };
  }

  if (projectType === "game") {
    return {
      coreFeatures: ["Gameplay loop", "Quản lý scene/state", "Xử lý input", "Tính điểm hoặc tiến trình"],
      optionalFeatures: ["Hiệu ứng âm thanh", "Bảng xếp hạng", "Trình sửa level", "Hướng dẫn chơi"],
      typeSpecific: {
        gameplayLoop: ["bắt đầu", "chơi", "xử lý va chạm/luật", "tính điểm/tiến trình", "chơi lại"],
        scenes: ["khởi động", "màn chơi chính", "kết thúc game"],
        assets: ["sprites", "background", "sound"],
        logic: ["luật chơi", "vật lý/va chạm", "điều kiện thắng/thua"]
      }
    };
  }

  if (projectType === "automation_tool") {
    return {
      coreFeatures: ["Định nghĩa trigger", "Pipeline hành động", "Xử lý retry/lỗi", "Nhật ký thực thi"],
      optionalFeatures: ["Chạy thủ công", "Thông báo khi lỗi", "Kiểm soát rate limit"],
      typeSpecific: {
        triggers: inferAutomationTriggers(normalized),
        actions: inferAutomationActions(normalized),
        integrations: inferIntegrations(rawIdea),
        failureHandling: ["retry có backoff", "idempotency key", "dead-letter log"]
      }
    };
  }

  if (projectType === "landing_page") {
    return {
      coreFeatures: ["Định vị offer", "Hero + CTA", "Các section bằng chứng/lợi ích", "Theo dõi chuyển đổi"],
      optionalFeatures: ["Form thu lead", "Biến thể A/B test", "Sơ đồ sự kiện analytics"],
      typeSpecific: {
        sections: ["Hero", "Vấn đề", "Lợi ích", "Cách hoạt động", "Bằng chứng", "CTA"],
        conversionGoal: /booking|demo/.test(normalized) ? "đặt lịch demo" : /signup|dang ky/.test(normalized) ? "đăng ký" : "bấm CTA chính",
        backendIfNeeded: /form|lead|booking|signup/.test(normalized)
      }
    };
  }

  if (projectType === "trading_bot") {
    return {
      coreFeatures: ["Hợp đồng chiến lược", "Adapter dữ liệu thị trường", "Chặn rủi ro", "Backtest", "Paper trading"],
      optionalFeatures: ["Bảng điều khiển", "Cảnh báo", "Phân tích danh mục"],
      typeSpecific: {
        strategy: ["tạo tín hiệu", "tính khối lượng vị thế", "stop loss/take profit"],
        dataSources: inferIntegrations(rawIdea).length ? inferIntegrations(rawIdea) : ["exchange API"],
        safety: ["lỗ tối đa mỗi lệnh", "giới hạn lỗ mỗi ngày", "chạy paper mode trước"]
      }
    };
  }

  if (projectType === "ai_tool") {
    return {
      coreFeatures: ["Schema input/output", "Chuỗi prompt", "Adapter model provider", "Checklist đánh giá"],
      optionalFeatures: ["Knowledge base RAG", "Streaming output", "Vòng phản hồi của người dùng"],
      typeSpecific: {
        aiFlow: ["thu input", "chuẩn bị ngữ cảnh", "gọi model", "kiểm tra output", "trình bày kết quả"],
        guardrails: ["kiểm tra schema", "xử lý dữ liệu nhạy cảm", "phản hồi dự phòng"],
        evals: ["ví dụ chuẩn", "rubric review", "prompt hồi quy"]
      }
    };
  }

  return {
    coreFeatures: [
      "Nhập ý tưởng",
      "Phân tích theo ngữ cảnh",
      "Đề xuất chức năng động",
      "Phân rã lộ trình/tác vụ",
      "Vòng đánh giá"
    ],
    optionalFeatures: [
      accountNeeded ? "Quản lý người dùng/workspace" : "Chế độ local một người dùng",
      persistenceNeeded ? "Lưu lịch sử bền vững" : "Lịch sử chỉ để xuất file",
      "Theo dõi tiến độ realtime"
    ],
    typeSpecific: {
      flows: ["gửi ý tưởng", "xem phân tích", "duyệt kế hoạch", "thực thi", "đánh giá/sửa"],
      state: persistenceNeeded ? ["dự án", "tài liệu", "tác vụ", "lượt chạy agent", "log"] : ["bộ nhớ tạm/session"],
      approvalGates: ["phân tích", "chức năng", "kiến trúc", "thực thi"]
    }
  };
}

function buildRoadmap(projectType: ProjectType, features: FeatureDiscovery, architecture: ArchitecturePlan): RoadmapMilestone[] {
  const typeLabel = typeLabels[projectType];
  const stackItems = [
    ...(architecture.frontend?.stack || []),
    ...(architecture.backend?.stack || []),
    ...(architecture.api?.style ? [architecture.api.style] : [])
  ].slice(0, 3);
  const mainStack = stackItems.join(", ") || "công nghệ phù hợp";

  const coreList = features.coreFeatures
    .filter((feature) => !/blueprint|cổng duyệt|nhật ký agent/i.test(feature))
    .slice(0, 3);
  const typeSpecificKeys = Object.keys(features.typeSpecific);
  const specificFeatures =
    typeSpecificKeys.length > 0 ? collectFeatureStrings(features.typeSpecific[typeSpecificKeys[0]]).slice(0, 3) : features.optionalFeatures.slice(0, 3);
  const milestones: RoadmapMilestone[] = [];

  if (stackItems.length || architecture.runtime.length) {
    milestones.push({
      id: createId(),
      title: `Chốt nền tảng triển khai cho ${typeLabel}`,
      objective: `Thiết lập phần nền cần có bằng ${mainStack}, chỉ gồm thành phần đã được kiến trúc đề xuất.`,
      deliverables: stackItems.length ? stackItems : architecture.runtime.slice(0, 3),
      exitCriteria: ["Có thể chạy luồng rỗng hoặc prototype tối thiểu.", "Không thêm stack ngoài kiến trúc đã duyệt."]
    });
  }

  for (const feature of coreList) {
    milestones.push({
      id: createId(),
      title: `Triển khai ${feature}`,
      objective: `Đưa "${feature}" thành luồng MVP kiểm chứng được cho ${typeLabel}.`,
      deliverables: [feature],
      exitCriteria: ["Luồng chính chạy được.", "Có trạng thái lỗi hoặc trường hợp rìa tối thiểu."]
    });
  }

  if (specificFeatures.length || architecture.integrations.length) {
    milestones.push({
      id: createId(),
      title: architecture.integrations.length ? `Kết nối ${architecture.integrations.slice(0, 3).join(", ")}` : "Hoàn thiện nghiệp vụ đặc thù",
      objective: "Hoàn thiện các phần riêng của ý tưởng, tích hợp hoặc dữ liệu domain.",
      deliverables: architecture.integrations.length ? architecture.integrations.slice(0, 3) : specificFeatures,
      exitCriteria: ["Luồng tích hợp/nghiệp vụ có xử lý lỗi.", "Không hardcode secret hoặc dữ liệu thật."]
    });
  }

  milestones.push({
    id: createId(),
    title: `Kiểm chứng luồng MVP của ${typeLabel}`,
    objective: "Chạy thử luồng chính, ghi nhận lỗi còn lại và chuẩn bị tài liệu chạy lại.",
    deliverables: ["Checklist kiểm thử", "Ghi chú vận hành", "Danh sách lỗi còn lại nếu có"],
    exitCriteria: ["Tiêu chí thành công chính được kiểm chứng.", "Có hướng dẫn chạy hoặc review kết quả."]
  });

  return milestones.slice(0, 6);
}

function buildTasks(
  project: Project,
  intent: IntentAnalysis,
  requirements: Requirements,
  features: FeatureDiscovery,
  architecture: ArchitecturePlan,
  roadmap: RoadmapMilestone[]
): TaskDraft[] {
  const parentTaskId = roadmap[1]?.id || roadmap[0]?.id || createId();
  const candidates = [
    ...contextualTasks(project, intent, requirements, features, architecture, parentTaskId),
    ...featureDrivenTasks(project, requirements, features, parentTaskId),
    ...architectureDrivenTasks(project, requirements, architecture, parentTaskId),
    ...integrationDrivenTasks(project, requirements, architecture, parentTaskId),
    validationTask(project, intent, requirements, parentTaskId)
  ];

  return dedupeTasks(candidates)
    .slice(0, 7)
    .map((task, index) => ({ ...task, priority: index + 1 }));
}

function featureDrivenTasks(
  project: Project,
  requirements: Requirements,
  features: FeatureDiscovery,
  parentTaskId: string
): TaskDraft[] {
  const ignored = new Set([
    "Blueprint dự án động theo ngữ cảnh",
    "Cổng duyệt trước các bước có tác động lớn",
    "Nhật ký agent theo thời gian"
  ]);
  const fromCore = features.coreFeatures.filter((feature) => !ignored.has(feature));
  const fromSpecific = collectFeatureStrings(features.typeSpecific).filter((feature) => feature.length <= 90);
  const picked = Array.from(new Set([...fromCore, ...fromSpecific])).slice(0, 3);

  return picked.map((feature, index) =>
    createTaskDraft({
      title: `Hiện thực hóa: ${feature}`,
      objective: `Chuyển phần "${feature}" trong ý tưởng "${compactIdea(project.rawIdea)}" thành đầu ra MVP có thể kiểm chứng.`,
      taskType: `implement_${taskSlug(feature)}`,
      targetArea: inferTargetAreaFromFeature(feature),
      parentTaskId,
      acceptanceCriteria: [
        `Kết quả phải phục vụ: ${requirements.oneLineSummary}`,
        `Có đầu ra cụ thể cho "${feature}" thay vì mô tả chung.`,
        "Không thêm phạm vi ngoài feature đã được duyệt."
      ],
      priority: index + 2
    })
  );
}

function architectureDrivenTasks(
  project: Project,
  requirements: Requirements,
  architecture: ArchitecturePlan,
  parentTaskId: string
): TaskDraft[] {
  const tasks: TaskDraft[] = [];

  if (architecture.frontend?.recommended) {
    tasks.push(
      createTaskDraft({
        title: "Thiết kế trải nghiệm chính theo workflow người dùng",
        objective: `Tạo luồng giao diện hoặc màn hình chính phục vụ ý tưởng: ${compactIdea(project.rawIdea)}.`,
        taskType: "design_primary_experience",
        targetArea: "frontend",
        parentTaskId,
        acceptanceCriteria: [
          `Workflow chính thể hiện được: ${requirements.oneLineSummary}`,
          "Các trạng thái nhập liệu, kết quả, lỗi và chờ xử lý được xác định rõ."
        ]
      })
    );
  }

  if (architecture.backend?.recommended) {
    tasks.push(
      createTaskDraft({
        title: "Xây dựng runtime nghiệp vụ cần thiết",
        objective: "Tạo lớp xử lý nghiệp vụ/tác vụ nền đúng với kiến trúc đã chọn, chỉ bao gồm phần thật sự cần cho MVP.",
        taskType: "build_runtime_logic",
        targetArea: "backend",
        parentTaskId,
        acceptanceCriteria: [
          "Runtime xử lý được workflow chính và trả lỗi có kiểm soát.",
          "Secret, token hoặc cấu hình tích hợp không bị hardcode trong code."
        ]
      })
    );
  }

  if (architecture.api?.recommended) {
    tasks.push(
      createTaskDraft({
        title: "Đặc tả hợp đồng API hoặc webhook",
        objective: "Xác định endpoint, payload, response và lỗi cho các luồng cần giao tiếp qua API/webhook.",
        taskType: "define_api_contract",
        targetArea: "api",
        parentTaskId,
        acceptanceCriteria: [
          "Mỗi endpoint/webhook có input, output và mã lỗi chính.",
          "Hợp đồng API khớp với workflow và không tạo CRUD thừa."
        ]
      })
    );
  }

  if (architecture.database?.recommended) {
    tasks.push(
      createTaskDraft({
        title: "Thiết kế lưu trữ cho trạng thái cần bền vững",
        objective: "Xác định dữ liệu cần lưu, vòng đời dữ liệu và ràng buộc tối thiểu cho MVP.",
        taskType: "design_persistence",
        targetArea: "database",
        parentTaskId,
        acceptanceCriteria: [
          "Chỉ lưu dữ liệu có lý do rõ trong yêu cầu hoặc workflow.",
          "Có chiến lược migrate/seed hoặc dữ liệu mẫu phục vụ kiểm thử."
        ]
      })
    );
  }

  return tasks.slice(0, 3);
}

function integrationDrivenTasks(
  project: Project,
  requirements: Requirements,
  architecture: ArchitecturePlan,
  parentTaskId: string
): TaskDraft[] {
  if (!architecture.integrations.length) return [];
  const integrations = architecture.integrations.slice(0, 3);
  return [
    createTaskDraft({
      title: `Kết nối tích hợp: ${integrations.join(", ")}`,
      objective: `Thiết kế luồng xác thực, gọi API/webhook và xử lý lỗi cho các tích hợp liên quan đến ý tưởng: ${compactIdea(project.rawIdea)}.`,
      taskType: `connect_${taskSlug(integrations.join("_"))}`,
      targetArea: "integrations",
      parentTaskId,
      acceptanceCriteria: [
        `Tích hợp phục vụ trực tiếp: ${requirements.oneLineSummary}`,
        "Có chiến lược retry/rate limit hoặc fallback khi dịch vụ ngoài lỗi.",
        "Không lưu token thật trong source code."
      ]
    })
  ];
}

function validationTask(project: Project, intent: IntentAnalysis, requirements: Requirements, parentTaskId: string): TaskDraft {
  return createTaskDraft({
    title: "Kiểm chứng MVP theo tiêu chí thành công",
    objective: `Chạy hoặc mô phỏng luồng chính của ${typeLabels[intent.projectType]} từ ý tưởng "${compactIdea(project.rawIdea)}" và ghi lại kết quả.`,
    taskType: "validate_mvp_flow",
    targetArea: "quality",
    parentTaskId,
    acceptanceCriteria: [
      ...requirements.successMetrics.slice(0, 3),
      "Có ghi chú lỗi còn lại và bước sửa tiếp theo nếu chưa đạt."
    ]
  });
}

function createTaskDraft(input: {
  title: string;
  objective: string;
  taskType: string;
  targetArea: string;
  parentTaskId: string;
  acceptanceCriteria: string[];
  dependencies?: string[];
  priority?: number;
}): TaskDraft {
  return {
    id: createId(),
    title: input.title,
    objective: input.objective,
    taskType: input.taskType,
    targetArea: input.targetArea,
    parentTaskId: input.parentTaskId,
    acceptanceCriteria: input.acceptanceCriteria,
    dependencies: input.dependencies ?? [],
    status: "pending",
    priority: input.priority ?? 1
  };
}

function dedupeTasks(tasks: TaskDraft[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.taskType}:${task.targetArea}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectFeatureStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectFeatureStrings(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => collectFeatureStrings(item));
  }
  return [];
}

function inferTargetAreaFromFeature(feature: string) {
  const normalized = normalize(feature);
  if (/screen|ui|hero|cta|section|scene|gameplay|asset|mobile|dashboard/.test(normalized)) return "experience";
  if (/api|webhook|provider|adapter|integration|command|event|trigger|action/.test(normalized)) return "runtime";
  if (/database|storage|state|history|log|audit|backtest|score/.test(normalized)) return "data";
  if (/prompt|schema|eval|guardrail|ai/.test(normalized)) return "ai_runtime";
  return "core";
}

function taskSlug(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "pham_vi";
}

function compactIdea(rawIdea: string) {
  const compact = rawIdea.replace(/\s+/g, " ").trim();
  return `${compact.slice(0, 120)}${compact.length > 120 ? "..." : ""}`;
}

function contextualTasks(
  project: Project,
  intent: IntentAnalysis,
  requirements: Requirements,
  features: FeatureDiscovery,
  architecture: ArchitecturePlan,
  parentTaskId: string
): TaskDraft[] {
  const commonAcceptance = [
    `Kết quả phải phục vụ: ${requirements.oneLineSummary}`,
    "Giữ phạm vi theo blueprint và tài liệu đã duyệt."
  ];

  if (intent.projectType === "bot") {
    return [
      {
        id: createId(),
        title: "Thiết kế luồng command và event cho bot",
        objective: "Mô tả command, event, quyền và luồng phản hồi của bot.",
        taskType: "setup_bot_command",
        targetArea: "bot_runtime",
        parentTaskId,
        acceptanceCriteria: [...commonAcceptance, "Có ít nhất command/event chính và phản hồi lỗi."],
        dependencies: [],
        status: "pending",
        priority: 3
      }
    ];
  }

  if (intent.projectType === "game") {
    return [
      {
        id: createId(),
        title: "Định nghĩa gameplay loop và scene",
        objective: "Thiết kế loop, scene, state và logic luật chơi cho game.",
        taskType: "create_game_loop",
        targetArea: "gameplay",
        parentTaskId,
        acceptanceCriteria: [...commonAcceptance, "Có vòng bắt đầu/chơi/kết thúc, input, điểm/tiến trình và danh sách asset."],
        dependencies: [],
        status: "pending",
        priority: 3
      }
    ];
  }

  if (intent.projectType === "automation_tool") {
    return [
      {
        id: createId(),
        title: "Lập sơ đồ luồng trigger-action",
        objective: "Định nghĩa trigger, action, retry và điểm tích hợp.",
        taskType: "implement_trigger",
        targetArea: "automation_runtime",
        parentTaskId,
        acceptanceCriteria: [...commonAcceptance, "Có trigger/action rõ ràng và chiến lược xử lý lỗi/retry."],
        dependencies: [],
        status: "pending",
        priority: 3
      }
    ];
  }

  if (intent.projectType === "mobile_app") {
    return [
      {
        id: createId(),
        title: "Thiết kế luồng màn hình di động",
        objective: "Tạo luồng màn hình, điều hướng và quyết định storage/API cho ứng dụng di động.",
        taskType: "design_screen",
        targetArea: "mobile_ui",
        parentTaskId,
        acceptanceCriteria: [...commonAcceptance, "Có screen map, đường điều hướng, quyết định local/remote state."],
        dependencies: [],
        status: "pending",
        priority: 3
      }
    ];
  }

  if (intent.projectType === "landing_page") {
    return [
      {
        id: createId(),
        title: "Phác thảo cấu trúc chuyển đổi landing page",
        objective: "Thiết kế section, CTA và mục tiêu tracking cho landing page.",
        taskType: "create_landing_section",
        targetArea: "conversion_ui",
        parentTaskId,
        acceptanceCriteria: [...commonAcceptance, "Có hero offer, CTA, section bằng chứng/lợi ích và metric chuyển đổi."],
        dependencies: [],
        status: "pending",
        priority: 3
      }
    ];
  }

  if (intent.projectType === "trading_bot") {
    return [
      {
        id: createId(),
        title: "Đặc tả chiến lược giao dịch và chặn rủi ro",
        objective: "Định nghĩa hợp đồng cho strategy, data, backtest và kiểm soát rủi ro.",
        taskType: "backtest_strategy",
        targetArea: "trading_engine",
        parentTaskId,
        acceptanceCriteria: [...commonAcceptance, "Có paper trading, giới hạn rủi ro và audit log trước live trading."],
        dependencies: [],
        status: "pending",
        priority: 3
      }
    ];
  }

  if (intent.projectType === "ai_tool") {
    return [
      {
        id: createId(),
        title: "Thiết kế luồng input-output và đánh giá AI",
        objective: "Định nghĩa schema input/output, chuỗi prompt và checklist đánh giá.",
        taskType: "write_prompt_chain",
        targetArea: "ai_runtime",
        parentTaskId,
        acceptanceCriteria: [...commonAcceptance, "Có chuỗi prompt, kiểm tra schema và rubric đánh giá."],
        dependencies: [],
        status: "pending",
        priority: 3
      }
    ];
  }

  return [
    {
      id: createId(),
      title: architecture.frontend?.recommended ? "Xây dựng luồng dashboard theo ngữ cảnh" : "Xây dựng luồng runtime theo ngữ cảnh",
      objective: architecture.frontend?.recommended
        ? "Tạo luồng UI để người dùng nhập, xem, sửa và duyệt tài liệu."
        : "Tạo luồng runtime tối thiểu phù hợp với dự án không cần UI.",
      taskType: architecture.frontend?.recommended ? "design_web_flow" : "runtime_flow",
      targetArea: architecture.frontend?.recommended ? "frontend" : "runtime",
      parentTaskId,
      acceptanceCriteria: [
        ...commonAcceptance,
        architecture.frontend?.recommended ? "Có các state phân tích/chức năng/lộ trình/prompt/nhật ký." : "Có luồng CLI/service và log output rõ ràng."
      ],
      dependencies: [],
      status: "pending",
      priority: 3
    }
  ];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s./_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFallbackType(normalized: string): ProjectType {
  if (/app|dashboard|system|tool|he thong|cong cu/.test(normalized)) {
    return "web_app";
  }
  return "unknown";
}

function inferPlatforms(projectType: ProjectType, normalized: string) {
  if (projectType === "mobile_app") return ["iOS", "Android"];
  if (projectType === "bot") return inferIntegrations(normalized).length ? inferIntegrations(normalized) : ["chat platform"];
  if (projectType === "game") return normalized.includes("mobile") ? ["mobile"] : ["web/browser"];
  if (projectType === "landing_page" || projectType === "web_app" || projectType === "saas") return ["web/browser"];
  if (projectType === "automation_tool" || projectType === "trading_bot") return ["server/worker"];
  if (projectType === "ai_tool") return normalized.includes("cli") ? ["CLI"] : ["web/browser", "API"];
  return [];
}

function buildMissingQuestions(projectType: ProjectType, normalized: string) {
  const questions: string[] = [];
  if (projectType === "unknown") {
    questions.push("Đầu ra mong muốn là ứng dụng, bot, game, automation hay tài liệu/prototype?");
  }
  if (!/user|nguoi dung|khach|team|admin|noi bo|developer|creator/.test(normalized)) {
    questions.push("Nhóm người dùng mục tiêu chính là ai?");
  }
  if (projectType === "automation_tool" && !/gmail|slack|sheet|api|file|database|webhook|email/.test(normalized)) {
    questions.push("Automation lấy dữ liệu từ đâu và gửi kết quả đến đâu?");
  }
  if (projectType === "bot" && !/telegram|discord|slack|zalo/.test(normalized)) {
    questions.push("Bot sẽ chạy trên nền tảng nào?");
  }
  if (projectType === "trading_bot" && !/paper|backtest|exchange|binance|broker/.test(normalized)) {
    questions.push("Bot cần backtest/paper trading trên sàn nào trước khi live?");
  }
  return questions.slice(0, 3);
}

function buildInitialAssumptions(projectType: ProjectType, normalized: string) {
  const assumptions = ["MVP ưu tiên tài liệu có thể duyệt/chỉnh sửa trước khi thực thi."];
  if (!needsPersistence(normalized, projectType)) {
    assumptions.push("Chưa thêm database nghiệp vụ nếu chưa có nhu cầu lưu state/lịch sử.");
  }
  if (projectType !== "web_app" && projectType !== "saas" && projectType !== "landing_page") {
    assumptions.push(`Không mặc định đây là web app; phân tích theo ${typeLabels[projectType]}.`);
  }
  return assumptions;
}

function titleForType(projectType: ProjectType) {
  return `Dự án ${typeLabels[projectType]}`;
}

function buildSummary(rawIdea: string, projectType: ProjectType) {
  const compact = rawIdea.replace(/\s+/g, " ").trim();
  return `${typeLabels[projectType]} giúp biến ý tưởng "${compact.slice(0, 140)}${compact.length > 140 ? "..." : ""}" thành kế hoạch và sản phẩm có thể thực thi.`;
}

function inferTargetUsers(rawIdea: string, projectType: ProjectType) {
  const normalized = normalize(rawIdea);
  if (/teacher|giao vien|hoc sinh|student/.test(normalized)) return ["Giáo viên", "Học sinh/sinh viên"];
  if (/sale|sales|marketing|lead|crm/.test(normalized)) return ["Đội sales/marketing", "Quản lý vận hành"];
  if (/developer|dev|coder|coding/.test(normalized)) return ["Developer", "Technical founder"];
  if (/admin|manager|quan ly/.test(normalized)) return ["Quản lý/Admin", "Nhân sự vận hành"];
  if (projectType === "game") return ["Người chơi mục tiêu", "Game designer"];
  if (projectType === "trading_bot") return ["Trader", "Người quản lý rủi ro"];
  if (projectType === "bot") return ["Người dùng trong kênh chat", "Admin kênh"];
  if (projectType === "automation_tool") return ["Người vận hành quy trình", "Người phụ trách báo cáo"];
  return ["Người dùng cuối", "Người quản lý sản phẩm"];
}

function buildProblemStatement(rawIdea: string, projectType: ProjectType) {
  return `Người dùng cần một ${typeLabels[projectType]} để giải quyết nhu cầu trong ý tưởng: ${rawIdea.trim()}`;
}

function buildPrimaryGoals(projectType: ProjectType) {
  const shared = ["Làm rõ phạm vi MVP", "Tạo tài liệu có thể review và lập phiên bản", "Giảm quyết định kỹ thuật thừa"];
  const specific: Record<ProjectType, string[]> = {
    web_app: ["Xác định user flow và UI state cần có"],
    mobile_app: ["Xác định screen flow và quyết định storage/API"],
    saas: ["Xác định workspace, role, billing/state nếu cần"],
    bot: ["Xác định command, event, quyền và phản hồi"],
    automation_tool: ["Xác định trigger, action, retry và tích hợp"],
    game: ["Xác định gameplay loop, scene, asset và luật chơi"],
    ai_tool: ["Xác định input/output, chuỗi prompt, đánh giá và guardrail"],
    trading_bot: ["Xác định strategy, risk guard, backtest và chế độ thực thi"],
    landing_page: ["Xác định offer, CTA, section và metric chuyển đổi"],
    unknown: ["Hỏi thêm ít thông tin nhất để chọn hướng đúng"]
  };
  return [...specific[projectType], ...shared];
}

function buildSuccessMetrics(projectType: ProjectType) {
  const metrics: Record<ProjectType, string[]> = {
    web_app: ["Người dùng hoàn tất workflow chính", "UI hiển thị đủ phân tích/lộ trình/tác vụ/log"],
    mobile_app: ["Screen flow hoàn chỉnh", "Quyết định state/offline/API rõ"],
    saas: ["Workspace/user flow rõ", "Có metric activation/retention"],
    bot: ["Command/event chính chạy đúng", "Phản hồi lỗi rõ ràng"],
    automation_tool: ["Trigger-action chạy idempotent", "Có log và retry"],
    game: ["Gameplay loop rõ và thú vị", "Có thắng/thua/tiến trình"],
    ai_tool: ["Output đúng schema", "Đánh giá đạt trên ví dụ mẫu"],
    trading_bot: ["Backtest/paper mode đạt", "Risk cap bắt buộc"],
    landing_page: ["CTA rõ", "Đo được sự kiện chuyển đổi"],
    unknown: ["Loại dự án được xác nhận", "Giả định được ghi lại"]
  };
  return metrics[projectType];
}

function needsPersistence(normalized: string, projectType: ProjectType) {
  return (
    projectType === "saas" ||
    projectType === "trading_bot" ||
    /database|db|luu|history|lich su|account|user|workspace|dashboard|report|bao cao|payment|billing|subscription|leaderboard|score|analytics|log/.test(
      normalized
    )
  );
}

function needsAccounts(normalized: string, projectType: ProjectType) {
  return projectType === "saas" || /auth|login|account|user|role|team|workspace|tenant|admin|billing|subscription/.test(normalized);
}

function needsIntegration(normalized: string, projectType: ProjectType) {
  return (
    projectType === "bot" ||
    projectType === "automation_tool" ||
    projectType === "trading_bot" ||
    /api|webhook|gmail|slack|discord|telegram|zalo|sheet|stripe|github|exchange|binance|email/.test(normalized)
  );
}

function inferIntegrations(rawIdea: string) {
  const normalized = normalize(rawIdea);
  const integrations = [
    ["gmail", "Gmail"],
    ["outlook", "Outlook"],
    ["slack", "Slack"],
    ["discord", "Discord"],
    ["telegram", "Telegram"],
    ["zalo", "Zalo"],
    ["sheet", "Google Sheets"],
    ["stripe", "Stripe"],
    ["github", "GitHub"],
    ["binance", "Binance"],
    ["shopify", "Shopify"],
    ["notion", "Notion"]
  ] as const;
  return integrations.filter(([keyword]) => normalized.includes(keyword)).map(([, label]) => label);
}

function inferBotCommands(normalized: string) {
  const commands = ["/start", "/help"];
  if (/report|bao cao/.test(normalized)) commands.push("/report");
  if (/search|tim/.test(normalized)) commands.push("/search");
  if (/alert|canh bao/.test(normalized)) commands.push("/alerts");
  if (commands.length === 2) commands.push("/run");
  return commands;
}

function inferAutomationTriggers(normalized: string) {
  if (/webhook/.test(normalized)) return ["webhook đến"];
  if (/schedule|cron|hang ngay|daily|weekly|hang tuan/.test(normalized)) return ["thời gian theo lịch"];
  if (/email|gmail|outlook/.test(normalized)) return ["email mới"];
  if (/sheet|file/.test(normalized)) return ["file/dòng dữ liệu mới hoặc thay đổi"];
  return ["chạy thủ công", "thời gian theo lịch"];
}

function inferAutomationActions(normalized: string) {
  const actions = [];
  if (/email|gmail|outlook/.test(normalized)) actions.push("gửi email");
  if (/slack|discord|telegram|zalo/.test(normalized)) actions.push("gửi thông báo chat");
  if (/report|bao cao/.test(normalized)) actions.push("tạo báo cáo");
  if (/sheet|database|db/.test(normalized)) actions.push("cập nhật kho dữ liệu");
  return actions.length ? actions : ["xử lý dữ liệu", "tạo output", "ghi log thực thi"];
}
