import { z } from "zod";

export const projectTypeSchema = z.enum([
  "web_app",
  "mobile_app",
  "saas",
  "bot",
  "automation_tool",
  "game",
  "ai_tool",
  "trading_bot",
  "landing_page",
  "unknown"
]);

export type ProjectType = z.infer<typeof projectTypeSchema>;

export const projectStatusSchema = z.enum([
  "draft",
  "analyzing",
  "awaiting_clarification",
  "awaiting_approval",
  "approved",
  "executing",
  "reviewing",
  "needs_fix",
  "completed",
  "failed"
]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const artifactTypeSchema = z.enum([
  "codebase_context",
  "intent_analysis",
  "requirements",
  "feature_discovery",
  "architecture_plan",
  "roadmap",
  "task_plan",
  "execution_prompt",
  "execution_result",
  "review_report",
  "fix_prompt",
  "memory_note"
]);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const agentNameSchema = z.enum([
  "codebase_analyzer",
  "intent_analyzer",
  "requirement_builder",
  "feature_discovery",
  "architecture_planner",
  "task_decomposer",
  "prompt_composer",
  "execution_agent",
  "review_agent",
  "memory_context_agent"
]);

export type AgentName = z.infer<typeof agentNameSchema>;

export type JsonObject = Record<string, unknown>;

export interface Project {
  id: string;
  name: string;
  rawIdea: string;
  mode: "new_project" | "existing_project";
  sourcePath?: string;
  projectType: ProjectType;
  status: ProjectStatus;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectArtifact<TContent = unknown> {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  version: number;
  content: TContent;
  status: "draft" | "ready" | "approved" | "superseded";
  createdByAgent: AgentName;
  approvedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  projectId: string;
  agentName: AgentName;
  status: "running" | "completed" | "failed";
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface AgentLog {
  id: string;
  projectId: string;
  agentRunId?: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata?: JsonObject;
  createdAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  objective: string;
  taskType: string;
  targetArea: string;
  acceptanceCriteria: string[];
  dependencies: string[];
  status: "pending" | "approved" | "running" | "completed" | "needs_fix" | "blocked";
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemory {
  id: string;
  projectId: string;
  memoryType: "user_preference" | "decision" | "feedback" | "execution_note";
  content: string;
  metadata?: JsonObject;
  createdAt: string;
}

export interface IntentAnalysis {
  projectType: ProjectType;
  confidence: number;
  reasoning: string;
  targetPlatforms: string[];
  missingQuestions: string[];
  initialAssumptions: string[];
  signals: string[];
}

export interface Requirements {
  projectName: string;
  oneLineSummary: string;
  targetUsers: string[];
  problemStatement: string;
  primaryGoals: string[];
  nonGoals: string[];
  constraints: string[];
  successMetrics: string[];
}

export interface FeatureDiscovery {
  coreFeatures: string[];
  optionalFeatures: string[];
  typeSpecific: JsonObject;
  excludedByDesign: string[];
}

export interface ArchitecturePlan {
  overview: string;
  frontend?: {
    recommended: boolean;
    rationale: string;
    stack: string[];
  };
  backend?: {
    recommended: boolean;
    rationale: string;
    stack: string[];
  };
  api?: {
    recommended: boolean;
    rationale: string;
    style?: string;
  };
  database?: {
    recommended: boolean;
    rationale: string;
    options: string[];
  };
  runtime: string[];
  integrations: string[];
  risks: string[];
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  objective: string;
  deliverables: string[];
  exitCriteria: string[];
}

export interface ExecutionPrompt {
  taskId: string;
  title: string;
  prompt: string;
  reviewChecklist: string[];
}

export interface FileEdit {
  path: string;
  action: "create" | "overwrite" | "replace" | "append";
  content?: string;
  oldText?: string;
  newText?: string;
}

export interface FileEditPlan {
  summary: string;
  edits: FileEdit[];
}

export interface AppliedFileEdit {
  path: string;
  action: FileEdit["action"];
  status: "applied" | "rejected";
  reason?: string;
}

export interface CodeEditIteration {
  iteration: number;
  promptTitle: string;
  provider: string;
  mode: string;
  summary: string;
  appliedEdits: AppliedFileEdit[];
  rejectedEdits: AppliedFileEdit[];
  executorExitCode?: number | null;
  stdout?: string;
  stderr?: string;
  sandboxResult?: ExecutionResult["sandboxResult"];
  fixPrompt?: string;
}

export interface CodebaseContext {
  sourcePath: string;
  rootName: string;
  packageManager?: string;
  frameworkSignals: string[];
  languages: string[];
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  keyFiles: string[];
  fileSamples: string[];
  ignoredDirectories: string[];
  stats: {
    fileCount: number;
    directoryCount: number;
    scannedAt: string;
  };
  detectedCommands: {
    install?: string;
    typecheck?: string;
    test?: string;
    build?: string;
    dev?: string;
  };
  risks: string[];
}

export interface ReviewReport {
  passed: boolean;
  score: number;
  findings: Array<{
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
    suggestedFix: string;
  }>;
  missingAcceptanceCriteria: string[];
  nextFixPrompt?: string;
  sandboxResult?: ExecutionResult["sandboxResult"];
}

export interface ApprovedArtifactSnapshot {
  artifactType: ArtifactType;
  artifactId: string;
  version: number;
  approvedAt: string;
}

export interface ExecutionResult {
  workspace: string;
  files: string[];
  completedTasks: number;
  approvedArtifactSnapshot: ApprovedArtifactSnapshot[];
  changedFiles: string[];
  codeEditIterations: CodeEditIteration[];
  providerResult?: {
    provider: string;
    mode: string;
    output: string;
  };
  sandboxResult?: {
    mode: string;
    available: boolean;
    commands: Array<{
      command: string;
      exitCode: number | null;
      stdout: string;
      stderr: string;
    }>;
  };
}

export interface ProjectBlueprint {
  project: Project;
  codebaseContext?: CodebaseContext;
  intentAnalysis?: IntentAnalysis;
  requirements?: Requirements;
  featureDiscovery?: FeatureDiscovery;
  architecturePlan?: ArchitecturePlan;
  roadmap?: RoadmapMilestone[];
  tasks: ProjectTask[];
  executionPrompts: ExecutionPrompt[];
  reviewResults: ReviewReport[];
  artifacts: ProjectArtifact[];
  agentRuns: AgentRun[];
  logs: AgentLog[];
  memories: ProjectMemory[];
}

export const createProjectInputSchema = z.object({
  rawIdea: z.string().min(8, "Hay nhap y tuong du an ro hon."),
  name: z.string().optional(),
  mode: z.enum(["new_project", "existing_project"]).optional().default("new_project"),
  sourcePath: z.string().optional(),
  autoAssume: z.boolean().optional().default(true)
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const analyzeProjectInputSchema = z
  .object({
    autoAssume: z.boolean().optional().default(true)
  })
  .strict();

export const updateProjectInputSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    rawIdea: z.string().min(8).max(8000).optional(),
    sourcePath: z.string().min(1).max(4000).optional()
  })
  .strict();

export const attachCodebaseInputSchema = z
  .object({
    sourcePath: z.string().min(1).max(4000)
  })
  .strict();

const stringArraySchema = z.array(z.string().min(1)).default([]);

export const intentAnalysisContentSchema = z
  .object({
    projectType: projectTypeSchema,
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    targetPlatforms: stringArraySchema,
    missingQuestions: stringArraySchema,
    initialAssumptions: stringArraySchema,
    signals: stringArraySchema
  })
  .strict();

export const requirementsContentSchema = z
  .object({
    projectName: z.string().min(1),
    oneLineSummary: z.string().min(1),
    targetUsers: stringArraySchema,
    problemStatement: z.string().min(1),
    primaryGoals: stringArraySchema,
    nonGoals: stringArraySchema,
    constraints: stringArraySchema,
    successMetrics: stringArraySchema
  })
  .strict();

export const featureDiscoveryContentSchema = z
  .object({
    coreFeatures: stringArraySchema,
    optionalFeatures: stringArraySchema,
    typeSpecific: z.record(z.unknown()),
    excludedByDesign: stringArraySchema
  })
  .strict();

const componentRecommendationSchema = z
  .object({
    recommended: z.boolean(),
    rationale: z.string(),
    stack: stringArraySchema.optional()
  })
  .strict();

export const architecturePlanContentSchema = z
  .object({
    overview: z.string().min(1),
    frontend: componentRecommendationSchema.optional(),
    backend: componentRecommendationSchema.optional(),
    api: z
      .object({
        recommended: z.boolean(),
        rationale: z.string(),
        style: z.string().optional()
      })
      .strict()
      .optional(),
    database: z
      .object({
        recommended: z.boolean(),
        rationale: z.string(),
        options: stringArraySchema
      })
      .strict()
      .optional(),
    runtime: stringArraySchema,
    integrations: stringArraySchema,
    risks: stringArraySchema
  })
  .strict();

export const roadmapMilestoneContentSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    objective: z.string().min(1),
    deliverables: stringArraySchema,
    exitCriteria: stringArraySchema
  })
  .strict();

export const projectTaskContentSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    parentTaskId: z.string().optional(),
    title: z.string().min(1),
    objective: z.string().min(1),
    taskType: z.string().min(1),
    targetArea: z.string().min(1),
    acceptanceCriteria: stringArraySchema,
    dependencies: stringArraySchema,
    status: z.enum(["pending", "approved", "running", "completed", "needs_fix", "blocked"]),
    priority: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  })
  .strict();

export const executionPromptContentSchema = z
  .object({
    taskId: z.string().min(1),
    title: z.string().min(1),
    prompt: z.string().min(1),
    reviewChecklist: stringArraySchema
  })
  .strict();

export const codebaseContextContentSchema = z
  .object({
    sourcePath: z.string().min(1),
    rootName: z.string().min(1),
    packageManager: z.string().optional(),
    frameworkSignals: stringArraySchema,
    languages: stringArraySchema,
    scripts: z.record(z.string()),
    dependencies: stringArraySchema,
    devDependencies: stringArraySchema,
    keyFiles: stringArraySchema,
    fileSamples: stringArraySchema,
    ignoredDirectories: stringArraySchema,
    stats: z
      .object({
        fileCount: z.number().int().nonnegative(),
        directoryCount: z.number().int().nonnegative(),
        scannedAt: z.string().min(1)
      })
      .strict(),
    detectedCommands: z
      .object({
        install: z.string().optional(),
        typecheck: z.string().optional(),
        test: z.string().optional(),
        build: z.string().optional(),
        dev: z.string().optional()
      })
      .strict(),
    risks: stringArraySchema
  })
  .strict();

export const updateArtifactContentInputSchema = z
  .object({
    content: z.unknown()
  })
  .strict();

export const editableArtifactTypes = [
  "intent_analysis",
  "codebase_context",
  "requirements",
  "feature_discovery",
  "architecture_plan",
  "roadmap",
  "task_plan",
  "execution_prompt"
] as const satisfies ArtifactType[];

export function parseEditableArtifactContent(artifactType: ArtifactType, content: unknown) {
  switch (artifactType) {
    case "intent_analysis":
      return intentAnalysisContentSchema.parse(content);
    case "codebase_context":
      return codebaseContextContentSchema.parse(content);
    case "requirements":
      return requirementsContentSchema.parse(content);
    case "feature_discovery":
      return featureDiscoveryContentSchema.parse(content);
    case "architecture_plan":
      return architecturePlanContentSchema.parse(content);
    case "roadmap":
      return z.array(roadmapMilestoneContentSchema).parse(content);
    case "task_plan":
      return z.array(projectTaskContentSchema).parse(content);
    case "execution_prompt":
      return z.array(executionPromptContentSchema).parse(content);
    default:
      throw new Error(`Artifact ${artifactType} is not editable`);
  }
}
