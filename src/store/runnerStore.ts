import { create } from "zustand";
import { runnerApi } from "../api/runnerApi";
import type { Project } from "../types/project.type";
import type { RunTaskPayload, TaskExecution } from "../types/execution.type";
import type { PromptTask } from "../types/task.type";

interface RunnerState {
  executionsByTaskId: Record<string, TaskExecution | undefined>;
  runnerOnline?: boolean;
  loading: boolean;
  error?: string;
  checkRunner: () => Promise<boolean>;
  runTask: (project: Project, task: PromptTask) => Promise<TaskExecution>;
  pollTask: (taskInternalId: string) => Promise<TaskExecution | undefined>;
  stopTask: (taskInternalId: string) => Promise<void>;
}

export const useRunnerStore = create<RunnerState>((set, get) => ({
  executionsByTaskId: {},
  loading: false,

  async checkRunner() {
    try {
      const health = await runnerApi.health();
      set({ runnerOnline: health.ok, error: undefined });
      return health.ok;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local runner chưa chạy.";
      set({ runnerOnline: false, error: message });
      return false;
    }
  },

  async runTask(project, task) {
    const workspaceDir = getWorkspaceDir(project);
    if (!workspaceDir) {
      throw new Error("Project chưa có Đường dẫn chạy Codex CLI. Hãy sửa project và nhập path thật, ví dụ /Applications/du-an/shop-app.");
    }

    const payload: RunTaskPayload = {
      taskInternalId: task.id,
      taskId: task.taskId,
      title: task.title,
      prompt: task.prompt,
      workspaceDir,
      folderName: project.localFolderName || project.name
    };

    set({ loading: true, error: undefined });
    try {
      const execution = await runnerApi.run(payload);
      set((state) => ({
        executionsByTaskId: {
          ...state.executionsByTaskId,
          [task.id]: execution
        },
        runnerOnline: true,
        loading: false
      }));
      return execution;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không chạy được task.";
      set({ error: message, runnerOnline: false, loading: false });
      throw error;
    }
  },

  async pollTask(taskInternalId) {
    const current = get().executionsByTaskId[taskInternalId];
    if (!current) return undefined;

    try {
      const execution = await runnerApi.status(current.executionId);
      set((state) => ({
        executionsByTaskId: {
          ...state.executionsByTaskId,
          [taskInternalId]: execution
        },
        error: execution.error
      }));
      return execution;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lấy được trạng thái chạy.";
      set({ error: message });
      return current;
    }
  },

  async stopTask(taskInternalId) {
    const current = get().executionsByTaskId[taskInternalId];
    if (!current) return;

    set({ loading: true, error: undefined });
    try {
      const execution = await runnerApi.stop(current.executionId);
      set((state) => ({
        executionsByTaskId: {
          ...state.executionsByTaskId,
          [taskInternalId]: execution
        },
        loading: false
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không dừng được task.";
      set({ error: message, loading: false });
    }
  }
}));

function getWorkspaceDir(project: Project): string {
  const explicit = project.localRunPath?.trim();
  if (explicit) return explicit;

  const source = project.sourceLocation?.trim() ?? "";
  if (source.startsWith("/") || source.startsWith("~")) {
    return source;
  }

  return project.localFolderName || project.name || "";
}
