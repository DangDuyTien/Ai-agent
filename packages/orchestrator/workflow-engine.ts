import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addArtifact,
  addLog,
  addMemory,
  createAgentRun,
  createId,
  finishAgentRun,
  getProjectBundle,
  latestArtifact,
  replaceProjectTasks,
  setProjectTypeFromAnalysis,
  updateProject,
  updateTask
} from "@/lib/store";
import { analyzeCodebase } from "@/packages/agents/codebase-analyzer";
import {
  runArchitecturePlanner,
  runFeatureDiscovery,
  runIntentAnalyzer,
  runPromptComposer,
  runRequirementBuilder,
  runTaskDecomposer
} from "@/packages/agents/heuristic-agents";
import { runCodingProvider } from "@/packages/orchestrator/llm-provider";
import { runCodeEditingLoop } from "@/packages/orchestrator/code-edit-executor";
import { runSandboxReview } from "@/packages/orchestrator/sandbox-runner";
import type {
  ApprovedArtifactSnapshot,
  AgentName,
  ArchitecturePlan,
  ArtifactType,
  CodebaseContext,
  ExecutionResult,
  ExecutionPrompt,
  FeatureDiscovery,
  IntentAnalysis,
  Project,
  ProjectArtifact,
  ProjectBlueprint,
  ProjectTask,
  Requirements,
  ReviewReport,
  RoadmapMilestone
} from "@/packages/schemas/project-blueprint.schema";

type AgentHandler<TOutput> = (runId: string) => Promise<TOutput> | TOutput;

const requiredApprovalArtifactTypes: ArtifactType[] = [
  "requirements",
  "feature_discovery",
  "architecture_plan",
  "task_plan",
  "execution_prompt"
];

interface AnalyzeOptions {
  autoAssume?: boolean;
}

export async function analyzeProject(projectId: string, options: AnalyzeOptions = {}) {
  const bundle = await requireBundle(projectId);
  const codebaseContext = latestArtifact<CodebaseContext>(bundle.artifacts, "codebase_context")?.content;
  await updateProject(projectId, { status: "analyzing" });
  await addLog(projectId, "info", "Bắt đầu phân tích ý tưởng bằng luồng agent.");

  const intent = await runAgent(projectId, "intent_analyzer", { rawIdea: bundle.project.rawIdea }, () =>
    runIntentAnalyzer(bundle.project)
  );
  await addArtifact(projectId, "intent_analysis", intent, "intent_analyzer");
  await setProjectTypeFromAnalysis(
    projectId,
    intent.projectType,
    intent.confidence,
    intent.missingQuestions.length && options.autoAssume === false ? "awaiting_clarification" : "analyzing"
  );

  if (intent.missingQuestions.length && options.autoAssume === false) {
    await addLog(projectId, "warn", "Cần người dùng trả lời thêm trước khi lập kế hoạch.", {
      missingQuestions: intent.missingQuestions
    });
    return buildBlueprint(projectId);
  }

  const latestProject = (await requireBundle(projectId)).project;
  const requirements = await runAgent(projectId, "requirement_builder", { intent, codebaseContext }, () => {
    const output = runRequirementBuilder(latestProject, intent);
    if (codebaseContext) {
      output.primaryGoals.unshift("Sửa/nâng cấp codebase hiện có với thay đổi tối thiểu và có thể review bằng diff.");
      output.constraints.push(`Codebase hiện có: ${codebaseContext.sourcePath}`);
      output.constraints.push(`Giữ framework/script hiện có: ${codebaseContext.frameworkSignals.join(", ") || "chưa rõ"}.`);
    }
    return output;
  });
  await addArtifact(projectId, "requirements", requirements, "requirement_builder");

  const features = await runAgent(projectId, "feature_discovery", { intent, requirements, codebaseContext }, () => {
    const output = runFeatureDiscovery(latestProject, intent, requirements);
    if (codebaseContext) {
      output.coreFeatures.unshift("Lập kế hoạch thay đổi theo codebase hiện có");
      output.typeSpecific = {
        ...output.typeSpecific,
        existingCodebase: {
          sourcePath: codebaseContext.sourcePath,
          keyFiles: codebaseContext.keyFiles.slice(0, 30),
          detectedCommands: codebaseContext.detectedCommands
        }
      };
    }
    return output;
  });
  await addArtifact(projectId, "feature_discovery", features, "feature_discovery");

  const architecture = await runAgent(projectId, "architecture_planner", { intent, features, codebaseContext }, () => {
    const output = runArchitecturePlanner(latestProject, intent, features);
    if (codebaseContext) {
      output.overview = `${output.overview} Chế độ sửa repo sẽ ưu tiên stack đang có: ${
        codebaseContext.frameworkSignals.join(", ") || "chưa rõ"
      }.`;
      output.runtime = Array.from(new Set([...output.runtime, ...Object.values(codebaseContext.detectedCommands).filter(Boolean)]));
      output.risks = Array.from(new Set([...output.risks, ...codebaseContext.risks]));
    }
    return output;
  });
  await addArtifact(projectId, "architecture_plan", architecture, "architecture_planner");

  const decomposed = await runAgent(projectId, "task_decomposer", { requirements, features, architecture, codebaseContext }, () => {
    const output = runTaskDecomposer(latestProject, intent, requirements, features, architecture);
    if (codebaseContext) {
      output.tasks.unshift({
        id: createId(),
        title: "Rà soát tác động lên codebase hiện có",
        objective: "Xác định file/module cần sửa trong repo hiện có trước khi thay đổi code.",
        taskType: "codebase_impact_analysis",
        targetArea: "existing_codebase",
        acceptanceCriteria: [
          "Chỉ ra file/module liên quan dựa trên ngữ cảnh codebase.",
          "Giữ trình quản lý gói, framework và script hiện có.",
          "Nếu cần thêm dependency, phải nêu lý do và rủi ro."
        ],
        dependencies: [],
        status: "pending",
        priority: 0
      });
    }
    return output;
  });
  await addArtifact(projectId, "roadmap", decomposed.roadmap, "task_decomposer");
  const storedTasks = await replaceProjectTasks(projectId, decomposed.tasks);
  await addArtifact(projectId, "task_plan", storedTasks, "task_decomposer");

  const executionPrompts = await runAgent(projectId, "prompt_composer", { tasks: storedTasks, codebaseContext }, () =>
    runPromptComposer(latestProject, requirements, features, architecture, storedTasks, codebaseContext)
  );
  await addArtifact(projectId, "execution_prompt", executionPrompts, "prompt_composer");

  await runAgent(projectId, "memory_context_agent", { intent, requirements }, async () => {
    const note = `Đã nhận diện ${intent.projectType} với độ tin cậy ${intent.confidence}. Cần duyệt trước khi thực thi.`;
    await addMemory(projectId, "decision", note, {
      projectType: intent.projectType,
      confidence: intent.confidence
    });
    return { note };
  });

  await updateProject(projectId, { name: requirements.projectName, status: "awaiting_approval" });
  await addLog(projectId, "info", "Đã tạo blueprint, lộ trình, kế hoạch tác vụ và prompt thực thi. Đang chờ người dùng duyệt.");
  return buildBlueprint(projectId);
}

export async function attachCodebaseToProject(projectId: string, sourcePath: string) {
  const bundle = await requireBundle(projectId);
  await addLog(projectId, "info", "Đang quét codebase hiện có.", { sourcePath });
  const context = await runAgent(projectId, "codebase_analyzer", { sourcePath }, () => analyzeCodebase(sourcePath));
  await addArtifact(projectId, "codebase_context", context, "codebase_analyzer");
  await updateProject(projectId, {
    mode: "existing_project",
    sourcePath: context.sourcePath,
    name: bundle.project.name || context.rootName
  });
  await addMemory(projectId, "decision", `Đã gắn codebase hiện có: ${context.sourcePath}`, {
    sourcePath: context.sourcePath,
    frameworkSignals: context.frameworkSignals
  });
  await addLog(projectId, "info", "Đã quét codebase và tạo tài liệu codebase_context.", {
    fileCount: context.stats.fileCount
  });
  return buildBlueprint(projectId);
}

export async function buildBlueprint(projectId: string): Promise<ProjectBlueprint> {
  const bundle = await requireBundle(projectId);
  const codebaseContext = latestArtifact<CodebaseContext>(bundle.artifacts, "codebase_context")?.content;
  const intent = latestArtifact<IntentAnalysis>(bundle.artifacts, "intent_analysis")?.content;
  const requirements = latestArtifact<Requirements>(bundle.artifacts, "requirements")?.content;
  const features = latestArtifact<FeatureDiscovery>(bundle.artifacts, "feature_discovery")?.content;
  const architecture = latestArtifact<ArchitecturePlan>(bundle.artifacts, "architecture_plan")?.content;
  const roadmap = latestArtifact<RoadmapMilestone[]>(bundle.artifacts, "roadmap")?.content;
  const prompts = latestArtifact<ExecutionPrompt[]>(bundle.artifacts, "execution_prompt")?.content;
  const reviewReports = bundle.artifacts
    .filter((item) => item.artifactType === "review_report")
    .map((item) => item.content as ReviewReport);

  return {
    project: bundle.project,
    codebaseContext,
    intentAnalysis: intent,
    requirements,
    featureDiscovery: features,
    architecturePlan: architecture,
    roadmap,
    tasks: bundle.tasks,
    executionPrompts: prompts ?? [],
    reviewResults: reviewReports,
    artifacts: bundle.artifacts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    agentRuns: bundle.agentRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    logs: bundle.logs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    memories: bundle.memories
  };
}

export async function executeProject(projectId: string) {
  const blueprint = await buildBlueprint(projectId);
  const approvedArtifactSnapshot = assertReadyForExecution(blueprint);

  await updateProject(projectId, { status: "executing" });
  const resultRunId = createId();
  const result = await runAgent<ExecutionResult>(
    projectId,
    "execution_agent",
    { taskCount: blueprint.tasks.length, approvedArtifactSnapshot },
    async (runId) => {
    const workspace = getExecutionWorkspace(blueprint);
    const outputDir = blueprint.project.mode === "existing_project" ? path.join(workspace, ".ai-agent", "runs", projectId) : workspace;
    await fs.mkdir(outputDir, { recursive: true });

    const blueprintFile = path.join(outputDir, "BLUEPRINT.json");
    const readmeFile = path.join(outputDir, "README.md");
    const tasksFile = path.join(outputDir, "TASKS.md");
    const promptsFile = path.join(outputDir, "PROMPTS.md");
    const providerOutputFile = path.join(outputDir, "PROVIDER_OUTPUT.md");
    
    await addLog(projectId, "info", `[Hệ thống] Đang chạy Provider adapter (tổng hợp kế hoạch cho ${blueprint.executionPrompts.length} prompts)...`, undefined, runId);
    const providerResult = await runCodingProvider(blueprint.executionPrompts);
    await addLog(projectId, "info", `[Hệ thống] Đã nhận kế hoạch tổng quan từ Provider. Nội dung:\n${providerResult.output}\n\nBắt đầu vòng lặp sửa code chi tiết...`, undefined, runId);

    const codeEditResult = await runCodeEditingLoop({
      workspace,
      prompts: blueprint.executionPrompts,
      codebaseContext: blueprint.codebaseContext,
      onLog: async (msg) => {
        await addLog(projectId, "info", msg, undefined, runId);
      },
      abortCheck: async () => {
        const currentProject = (await getProjectBundle(projectId))?.project;
        return currentProject?.status === "failed";
      }
    });

    await fs.writeFile(
      blueprintFile,
      JSON.stringify(
        {
          project: blueprint.project,
          intentAnalysis: blueprint.intentAnalysis,
          requirements: blueprint.requirements,
          featureDiscovery: blueprint.featureDiscovery,
          architecturePlan: blueprint.architecturePlan,
          codebaseContext: blueprint.codebaseContext,
          roadmap: blueprint.roadmap,
          tasks: blueprint.tasks,
          approvedArtifactSnapshot
        },
        null,
        2
      ),
      "utf8"
    );

    await fs.writeFile(readmeFile, renderReadme(blueprint.project, blueprint), "utf8");
    await fs.writeFile(tasksFile, renderTasks(blueprint.tasks), "utf8");
    await fs.writeFile(promptsFile, renderPrompts(blueprint.executionPrompts), "utf8");
    await fs.writeFile(providerOutputFile, providerResult.output, "utf8");

    for (const task of blueprint.tasks) {
      await updateTask(projectId, task.id, { status: "completed" });
    }

    return {
      workspace,
      files: [blueprintFile, readmeFile, tasksFile, promptsFile, providerOutputFile],
      completedTasks: blueprint.tasks.length,
      approvedArtifactSnapshot,
      changedFiles: codeEditResult.changedFiles,
      codeEditIterations: codeEditResult.iterations,
      providerResult
    };
  });

  await addArtifact(projectId, "execution_result", result, "execution_agent");
  await updateProject(projectId, { status: "reviewing" });
  await addLog(projectId, "info", "Agent thực thi đã tạo kết quả trong thư mục làm việc và đánh dấu tác vụ hoàn tất.", {
    workspace: result.workspace
  });
  return result;
}

export async function reviewProject(projectId: string): Promise<ReviewReport> {
  const blueprint = await buildBlueprint(projectId);
  const bundle = await requireBundle(projectId);
  const executionResult = latestArtifact<ExecutionResult>(bundle.artifacts, "execution_result")?.content;

  await updateProject(projectId, { status: "reviewing" });
  const report = await runAgent(projectId, "review_agent", { executionResult }, async () => {
    const findings: ReviewReport["findings"] = [];
    const missingAcceptanceCriteria: string[] = [];
    const sandboxResult = executionResult ? await runSandboxReview(executionResult.workspace) : undefined;

    if (!executionResult) {
      findings.push({
        severity: "high",
        title: "Chưa có tài liệu thực thi",
        detail: "Agent đánh giá không tìm thấy kết quả của Agent thực thi.",
        suggestedFix: "Chạy /execute sau khi tài liệu đã được duyệt."
      });
    } else {
      for (const filePath of executionResult.files) {
        try {
          await fs.access(filePath);
        } catch {
          findings.push({
            severity: "high",
            title: "Thiếu file đầu ra",
            detail: `Không tìm thấy file ${filePath}.`,
            suggestedFix: "Chạy lại Agent thực thi để tạo đủ tài liệu."
          });
        }
      }

      if (!executionResult.approvedArtifactSnapshot?.length) {
        findings.push({
          severity: "high",
          title: "Lần thực thi thiếu snapshot tài liệu đã duyệt",
          detail: "Kết quả thực thi không ghi lại bộ tài liệu/phiên bản đã được duyệt.",
          suggestedFix: "Chạy lại Agent thực thi sau khi cổng duyệt đã tạo snapshot."
        });
      } else {
        findings.push(...compareSnapshotWithLatestArtifacts(blueprint.artifacts, executionResult.approvedArtifactSnapshot));
      }

      for (const iteration of executionResult.codeEditIterations ?? []) {
        iteration.rejectedEdits.forEach((edit) => {
          findings.push({
            severity: "high",
            title: `Edit code bị từ chối: ${edit.path}`,
            detail: edit.reason || "Chỉnh sửa file bị từ chối do kiểm tra đường dẫn/nội dung.",
            suggestedFix: "Tạo prompt sửa với đường dẫn hợp lệ và nội dung chỉnh sửa đúng ngữ cảnh."
          });
        });

        iteration.sandboxResult?.commands
          .filter((command) => command.exitCode !== 0)
          .forEach((command) => {
            findings.push({
              severity: "high",
              title: `Sandbox thực thi thất bại: ${command.command}`,
              detail: command.stderr || command.stdout || "Lệnh thất bại nhưng không có output.",
              suggestedFix: iteration.fixPrompt || "Tạo prompt sửa dựa trên lỗi sandbox và chạy lại vòng edit code."
            });
          });
      }
    }

    if (sandboxResult) {
      if (!sandboxResult.available) {
        findings.push({
          severity: process.env.AI_AGENT_SANDBOX === "docker" ? "high" : "medium",
          title: "Sandbox chưa sẵn sàng",
          detail: sandboxResult.commands.map((item) => item.stderr).filter(Boolean).join("\n") || "Sandbox runner không khả dụng.",
          suggestedFix: "Cài Docker hoặc đổi AI_AGENT_SANDBOX=local."
        });
      }

      sandboxResult.commands
        .filter((item) => item.exitCode !== 0)
        .forEach((item) => {
          findings.push({
            severity: "high",
            title: `Lệnh sandbox thất bại: ${item.command}`,
            detail: item.stderr || item.stdout || "Lệnh thất bại nhưng không có output.",
            suggestedFix: "Sửa code trong thư mục làm việc để lệnh review chạy đạt."
          });
        });
    }

    if (!blueprint.intentAnalysis || !blueprint.requirements || !blueprint.featureDiscovery || !blueprint.architecturePlan) {
      missingAcceptanceCriteria.push("Blueprint cần đủ tài liệu phân tích ý định, yêu cầu, chức năng và kiến trúc.");
    }
    if (!blueprint.executionPrompts.length) {
      missingAcceptanceCriteria.push("Cần có prompt thực thi cho agent lập trình.");
    }
    if (blueprint.project.projectType !== "web_app" && blueprint.architecturePlan?.frontend?.recommended === true) {
      const frontendReason = blueprint.architecturePlan.frontend.rationale.toLowerCase();
      if (!frontendReason.includes("ui") && !frontendReason.includes("mobile") && !frontendReason.includes("game")) {
        findings.push({
          severity: "medium",
          title: "Cần kiểm tra lại lý do dùng frontend",
          detail: "Dự án không phải app web nhưng frontend được đề xuất, cần có lý do rõ ràng.",
          suggestedFix: "Cập nhật Agent lập kiến trúc để giải thích vì sao cần frontend."
        });
      }
    }

    const passed = findings.filter((item) => item.severity === "high").length === 0 && missingAcceptanceCriteria.length === 0;
    const score = Math.max(0, 100 - findings.length * 15 - missingAcceptanceCriteria.length * 20);

    return {
      passed,
      score,
      findings,
      missingAcceptanceCriteria,
      sandboxResult,
      nextFixPrompt: passed
        ? undefined
        : buildFixPrompt(blueprint.project, findings, missingAcceptanceCriteria)
    };
  });

  await addArtifact(projectId, "review_report", report, "review_agent");
  if (report.nextFixPrompt) {
    await addArtifact(projectId, "fix_prompt", { prompt: report.nextFixPrompt }, "review_agent");
  }
  await updateProject(projectId, { status: report.passed ? "completed" : "needs_fix" });
  await addLog(projectId, report.passed ? "info" : "warn", report.passed ? "Đánh giá đạt." : "Đánh giá chưa đạt, đã tạo prompt sửa lỗi.", {
    score: report.score
  });
  return report;
}

async function runAgent<TOutput>(
  projectId: string,
  agentName: AgentName,
  input: unknown,
  handler: AgentHandler<TOutput>
): Promise<TOutput> {
  const run = await createAgentRun(projectId, agentName, input);
  const agentLabel = formatAgentName(agentName);
  await addLog(projectId, "info", `${agentLabel} đang chạy.`, undefined, run.id);
  try {
    const output = await handler(run.id);
    await finishAgentRun(run.id, output);
    await addLog(projectId, "info", `${agentLabel} đã hoàn tất.`, undefined, run.id);
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi chưa xác định";
    await finishAgentRun(run.id, undefined, message);
    await addLog(projectId, "error", `${agentLabel} lỗi: ${message}`, undefined, run.id);
    throw error;
  }
}

function formatAgentName(agentName: AgentName) {
  const labels: Record<AgentName, string> = {
    codebase_analyzer: "Agent phân tích codebase",
    intent_analyzer: "Agent phân tích ý định",
    requirement_builder: "Agent xây dựng yêu cầu",
    feature_discovery: "Agent khám phá chức năng",
    architecture_planner: "Agent lập kiến trúc",
    task_decomposer: "Agent chia nhỏ tác vụ",
    prompt_composer: "Agent soạn prompt",
    execution_agent: "Agent thực thi",
    review_agent: "Agent đánh giá",
    memory_context_agent: "Agent bộ nhớ/ngữ cảnh"
  };
  return labels[agentName] ?? agentName;
}

async function requireBundle(projectId: string) {
  const bundle = await getProjectBundle(projectId);
  if (!bundle) {
    throw new Error(`Không tìm thấy dự án ${projectId}`);
  }
  return bundle;
}

function assertReadyForExecution(blueprint: ProjectBlueprint): ApprovedArtifactSnapshot[] {
  const requiredTypes =
    blueprint.project.mode === "existing_project"
      ? (["codebase_context", ...requiredApprovalArtifactTypes] as ArtifactType[])
      : requiredApprovalArtifactTypes;
  const snapshot: ApprovedArtifactSnapshot[] = [];
  const missingApprovals = requiredTypes.filter((type) => {
    const latest = latestArtifact(blueprint.artifacts, type);
    if (!latest || !latest.approvedByUser || latest.status !== "approved") {
      return true;
    }
    snapshot.push({
      artifactType: latest.artifactType,
      artifactId: latest.id,
      version: latest.version,
      approvedAt: latest.updatedAt
    });
    return false;
  });
  if (missingApprovals.length) {
    throw new Error(`Cần duyệt phiên bản tài liệu mới nhất trước khi thực thi: ${missingApprovals.join(", ")}`);
  }
  return snapshot;
}

function compareSnapshotWithLatestArtifacts(
  artifacts: ProjectArtifact[],
  snapshot: ApprovedArtifactSnapshot[]
): ReviewReport["findings"] {
  const findings: ReviewReport["findings"] = [];
  for (const item of snapshot) {
    const latest = latestArtifact(artifacts, item.artifactType);
    if (!latest) {
      findings.push({
        severity: "high",
        title: `Thiếu tài liệu ${item.artifactType}`,
        detail: "Agent đánh giá không tìm thấy tài liệu trong snapshot.",
        suggestedFix: "Chạy lại phân tích và duyệt lại tài liệu."
      });
      continue;
    }
    if (latest.id !== item.artifactId || latest.version !== item.version || !latest.approvedByUser) {
      findings.push({
        severity: "high",
        title: `Kế hoạch đã thay đổi sau thực thi: ${item.artifactType}`,
        detail: `Lần thực thi dùng version ${item.version}, version mới nhất hiện tại là ${latest.version}.`,
        suggestedFix: "Duyệt tài liệu mới nhất và chạy lại Agent thực thi."
      });
    }
  }
  return findings;
}

function renderReadme(project: Project, blueprint: ProjectBlueprint) {
  return [
    `# ${project.name}`,
    "",
    "Được tạo bởi Hệ thống AI Agent tổng quát MVP.",
    "",
    "## Loại dự án",
    "",
    project.projectType,
    "",
    "## Tóm tắt",
    "",
    blueprint.requirements?.oneLineSummary ?? "Chưa tạo tóm tắt.",
    "",
    "## Kiến trúc",
    "",
    blueprint.architecturePlan?.overview ?? "Chưa tạo kế hoạch kiến trúc.",
    "",
    "## Bước tiếp theo",
    "",
    "Dùng PROMPTS.md với agent lập trình AI để triển khai từng tác vụ đã duyệt."
  ].join("\n");
}

function renderTasks(tasks: ProjectTask[]) {
  return tasks
    .map((task, index) =>
      [
        `## ${index + 1}. ${task.title}`,
        "",
        `- Loại: ${task.taskType}`,
        `- Vùng tác động: ${task.targetArea}`,
        `- Mục tiêu: ${task.objective}`,
        "- Tiêu chí nghiệm thu:",
        ...task.acceptanceCriteria.map((item) => `  - ${item}`)
      ].join("\n")
    )
    .join("\n\n");
}

function renderPrompts(prompts: ExecutionPrompt[]) {
  return prompts
    .map((item, index) => [`## Prompt ${index + 1}: ${item.title}`, "", "```text", item.prompt, "```"].join("\n"))
    .join("\n\n");
}

function buildFixPrompt(project: Project, findings: ReviewReport["findings"], missingAcceptanceCriteria: string[]) {
  return [
    `Bạn đang sửa kết quả đã tạo cho ${project.name}.`,
    "",
    "Phát hiện khi đánh giá:",
    ...findings.map((item) => `- [${item.severity}] ${item.title}: ${item.detail}. Fix: ${item.suggestedFix}`),
    "",
    "Tiêu chí nghiệm thu còn thiếu:",
    ...(missingAcceptanceCriteria.length ? missingAcceptanceCriteria.map((item) => `- ${item}`) : ["- Không có"]),
    "",
    "Chỉ sửa các mục đang lỗi. Giữ nguyên quyết định blueprint đã duyệt và không thêm chức năng không liên quan."
  ].join("\n");
}

function getWorkspaceRoot() {
  return process.env.AI_AGENT_WORKSPACE_ROOT || path.join(process.cwd(), "workspaces", "projects");
}

function getExecutionWorkspace(blueprint: ProjectBlueprint) {
  if (blueprint.project.mode === "existing_project") {
    if (!blueprint.project.sourcePath) {
      throw new Error("Dự án có sẵn đang thiếu sourcePath");
    }
    return blueprint.project.sourcePath;
  }
  return path.join(getWorkspaceRoot(), blueprint.project.id);
}
