import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AgentLog,
  AgentName,
  AgentRun,
  ArtifactType,
  Project,
  ProjectArtifact,
  ProjectMemory,
  ProjectStatus,
  ProjectTask,
  ProjectType
} from "@/packages/schemas/project-blueprint.schema";

let dbMutex: Promise<void> = Promise.resolve();

export interface DatabaseShape {
  projects: Project[];
  artifacts: ProjectArtifact[];
  agentRuns: AgentRun[];
  logs: AgentLog[];
  tasks: ProjectTask[];
  memories: ProjectMemory[];
}

const emptyDb: DatabaseShape = {
  projects: [],
  artifacts: [],
  agentRuns: [],
  logs: [],
  tasks: [],
  memories: []
};

function now() {
  return new Date().toISOString();
}

async function ensureDb() {
  const dbPath = getDbPath();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(emptyDb, null, 2), "utf8");
  }
}

export async function readDb(): Promise<DatabaseShape> {
  await ensureDb();
  const dbPath = getDbPath();
  const raw = await fs.readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<DatabaseShape>;
  return {
    projects: (parsed.projects ?? []).map((project) => ({
      ...project,
      mode: project.mode ?? "new_project"
    })),
    artifacts: parsed.artifacts ?? [],
    agentRuns: parsed.agentRuns ?? [],
    logs: parsed.logs ?? [],
    tasks: parsed.tasks ?? [],
    memories: parsed.memories ?? []
  };
}

export async function writeDb(db: DatabaseShape) {
  await ensureDb();
  const dbPath = getDbPath();
  const tempPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tempPath, dbPath);
}

export async function mutateDb<T>(mutator: (db: DatabaseShape) => T | Promise<T>): Promise<T> {
  const previous = dbMutex;
  let release!: () => void;
  dbMutex = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);
  try {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  } finally {
    release();
  }
}

export async function createProject(
  rawIdea: string,
  name?: string,
  mode: Project["mode"] = "new_project",
  sourcePath?: string
): Promise<Project> {
  return mutateDb((db) => {
    const project: Project = {
      id: randomUUID(),
      name: name?.trim() || inferProjectName(rawIdea),
      rawIdea,
      mode,
      sourcePath,
      projectType: "unknown",
      status: "draft",
      confidence: 0,
      createdAt: now(),
      updatedAt: now()
    };
    db.projects.unshift(project);
    return project;
  });
}

export async function updateProject(
  projectId: string,
  patch: Partial<Pick<Project, "name" | "projectType" | "status" | "confidence" | "rawIdea" | "mode" | "sourcePath">>
): Promise<Project> {
  return mutateDb((db) => {
    const project = db.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error(`Không tìm thấy dự án ${projectId}`);
    }
    Object.assign(project, patch, { updatedAt: now() });
    return project;
  });
}

export async function addArtifact<TContent>(
  projectId: string,
  artifactType: ArtifactType,
  content: TContent,
  createdByAgent: AgentName,
  status: ProjectArtifact["status"] = "ready"
): Promise<ProjectArtifact<TContent>> {
  return mutateDb((db) => {
    const version =
      db.artifacts.filter((item) => item.projectId === projectId && item.artifactType === artifactType).length + 1;
    db.artifacts
      .filter((item) => item.projectId === projectId && item.artifactType === artifactType)
      .forEach((item) => {
        if (item.status !== "approved") {
          item.status = "superseded";
        }
      });
    const artifact: ProjectArtifact<TContent> = {
      id: randomUUID(),
      projectId,
      artifactType,
      version,
      content,
      status,
      createdByAgent,
      approvedByUser: false,
      createdAt: now(),
      updatedAt: now()
    };
    db.artifacts.push(artifact as ProjectArtifact);
    return artifact;
  });
}

export async function updateArtifactContent<TContent>(
  projectId: string,
  artifactId: string,
  content: TContent
): Promise<ProjectArtifact<TContent>> {
  return mutateDb((db) => {
    const artifact = db.artifacts.find((item) => item.projectId === projectId && item.id === artifactId);
    if (!artifact) {
      throw new Error(`Không tìm thấy tài liệu ${artifactId}`);
    }
    artifact.content = content;
    artifact.status = "ready";
    artifact.approvedByUser = false;
    artifact.updatedAt = now();
    return artifact as ProjectArtifact<TContent>;
  });
}

export async function getArtifact(projectId: string, artifactId: string): Promise<ProjectArtifact | null> {
  const db = await readDb();
  return db.artifacts.find((item) => item.projectId === projectId && item.id === artifactId) ?? null;
}

export async function approveArtifact(projectId: string, artifactId: string): Promise<ProjectArtifact> {
  return mutateDb((db) => {
    const artifact = db.artifacts.find((item) => item.projectId === projectId && item.id === artifactId);
    if (!artifact) {
      throw new Error(`Không tìm thấy tài liệu ${artifactId}`);
    }
    artifact.status = "approved";
    artifact.approvedByUser = true;
    artifact.updatedAt = now();
    return artifact;
  });
}

export async function createAgentRun(projectId: string, agentName: AgentName, input: unknown): Promise<AgentRun> {
  return mutateDb((db) => {
    const run: AgentRun = {
      id: randomUUID(),
      projectId,
      agentName,
      status: "running",
      input,
      startedAt: now()
    };
    db.agentRuns.push(run);
    return run;
  });
}

export async function finishAgentRun(runId: string, output: unknown, error?: string): Promise<AgentRun> {
  return mutateDb((db) => {
    const run = db.agentRuns.find((item) => item.id === runId);
    if (!run) {
      throw new Error(`Không tìm thấy lượt chạy agent ${runId}`);
    }
    run.status = error ? "failed" : "completed";
    run.output = output;
    run.error = error;
    run.finishedAt = now();
    return run;
  });
}

export async function addLog(
  projectId: string,
  level: AgentLog["level"],
  message: string,
  metadata?: AgentLog["metadata"],
  agentRunId?: string
): Promise<AgentLog> {
  const colorMap = {
    info: "\x1b[36m",    // Cyan
    warn: "\x1b[33m",    // Yellow
    error: "\x1b[31m",   // Red
    success: "\x1b[32m"  // Green
  };
  const resetColor = "\x1b[0m";
  const color = colorMap[level as keyof typeof colorMap] || resetColor;
  
  // In trực tiếp ra Terminal thật (VSCode/iTerm)
  console.log(`${color}[AI-AGENT] [${level.toUpperCase()}]${resetColor} ${message}`);

  return mutateDb((db) => {
    const log: AgentLog = {
      id: randomUUID(),
      projectId,
      agentRunId,
      level,
      message,
      metadata,
      createdAt: now()
    };
    db.logs.push(log);
    return log;
  });
}

export async function replaceProjectTasks(projectId: string, tasks: Omit<ProjectTask, "projectId" | "createdAt" | "updatedAt">[]) {
  return mutateDb((db) => {
    db.tasks = db.tasks.filter((item) => item.projectId !== projectId);
    const stamped = tasks.map((task) => ({
      ...task,
      projectId,
      createdAt: now(),
      updatedAt: now()
    }));
    db.tasks.push(...stamped);
    return stamped;
  });
}

export async function setProjectTasks(projectId: string, tasks: ProjectTask[]) {
  return mutateDb((db) => {
    db.tasks = db.tasks.filter((item) => item.projectId !== projectId);
    const stamped = tasks.map((task) => ({
      ...task,
      projectId,
      updatedAt: now()
    }));
    db.tasks.push(...stamped);
    return stamped;
  });
}

export async function updateTask(projectId: string, taskId: string, patch: Partial<ProjectTask>): Promise<ProjectTask> {
  return mutateDb((db) => {
    const task = db.tasks.find((item) => item.projectId === projectId && item.id === taskId);
    if (!task) {
      throw new Error(`Không tìm thấy tác vụ ${taskId}`);
    }
    Object.assign(task, patch, { updatedAt: now() });
    return task;
  });
}

export async function addMemory(
  projectId: string,
  memoryType: ProjectMemory["memoryType"],
  content: string,
  metadata?: ProjectMemory["metadata"]
): Promise<ProjectMemory> {
  return mutateDb((db) => {
    const memory: ProjectMemory = {
      id: randomUUID(),
      projectId,
      memoryType,
      content,
      metadata,
      createdAt: now()
    };
    db.memories.push(memory);
    return memory;
  });
}

export async function getProjectBundle(projectId: string) {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }
  return {
    project,
    artifacts: db.artifacts.filter((item) => item.projectId === projectId),
    agentRuns: db.agentRuns.filter((item) => item.projectId === projectId),
    logs: db.logs.filter((item) => item.projectId === projectId),
    tasks: db.tasks.filter((item) => item.projectId === projectId).sort((a, b) => a.priority - b.priority),
    memories: db.memories.filter((item) => item.projectId === projectId)
  };
}

export function latestArtifact<TContent>(
  artifacts: ProjectArtifact[],
  artifactType: ArtifactType
): ProjectArtifact<TContent> | undefined {
  return artifacts
    .filter((item) => item.artifactType === artifactType)
    .sort((a, b) => b.version - a.version)[0] as ProjectArtifact<TContent> | undefined;
}

export async function listProjects() {
  const db = await readDb();
  return db.projects;
}

export function createId() {
  return randomUUID();
}

export function setProjectTypeFromAnalysis(projectId: string, projectType: ProjectType, confidence: number, status: ProjectStatus) {
  return updateProject(projectId, { projectType, confidence, status });
}

function getDbPath() {
  return process.env.AI_AGENT_DB_PATH || path.join(process.cwd(), "data", "db.json");
}

function inferProjectName(rawIdea: string) {
  const cleaned = rawIdea.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "Dự án AI chưa đặt tên";
  }
  const words = cleaned.split(" ").slice(0, 7).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
