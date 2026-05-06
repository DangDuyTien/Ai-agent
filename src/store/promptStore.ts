import { create } from "zustand";
import { persist } from "zustand/middleware";
import { requestApi } from "../api/requestApi";
import type { AiAnalysis, MasterPrompt, PromptVersion } from "../types/prompt.type";
import type { Project } from "../types/project.type";
import type { AiRequest } from "../types/request.type";
import type { PromptTask } from "../types/task.type";
import { createId, nowIso } from "../utils/id";
import {
  createLocalAnalysis,
  findTaskById,
  generateMasterPrompt,
  getOrderedExecutableTasks,
  splitPromptIntoTasks,
  splitTaskMore,
  updateTaskInTree
} from "../utils/splitPrompt";
import { validateMasterPrompt, validateTaskTree } from "../utils/validatePrompt";
import { useRequestStore } from "./requestStore";

const useMockApi = import.meta.env.VITE_USE_MOCK_API !== "false";

interface PromptState {
  analyses: Record<string, AiAnalysis>;
  masterPrompts: Record<string, MasterPrompt>;
  taskTrees: Record<string, PromptTask>;
  selectedTaskIdByRequest: Record<string, string | undefined>;
  versions: PromptVersion[];
  loading: boolean;
  error?: string;
  analyzeRequest: (project: Project, request: AiRequest) => Promise<AiAnalysis>;
  generateMaster: (project: Project, request: AiRequest) => Promise<MasterPrompt>;
  splitTasks: (project: Project, request: AiRequest) => Promise<PromptTask>;
  splitMore: (requestId: string, taskInternalId: string) => void;
  updateMasterPrompt: (requestId: string, content: string) => void;
  saveVersion: (requestId: string, note?: string) => void;
  selectTask: (requestId: string, taskInternalId?: string) => void;
  getOrderedPrompts: (requestId: string) => PromptTask[];
  getSelectedTask: (requestId: string) => PromptTask | undefined;
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      analyses: {},
      masterPrompts: {},
      taskTrees: {},
      selectedTaskIdByRequest: {},
      versions: [],
      loading: false,

      async analyzeRequest(project, request) {
        set({ loading: true, error: undefined });
        useRequestStore.getState().setRequestStatus(request.id, "analyzing");
        try {
          const analysis = useMockApi ? createLocalAnalysis(project, request) : await requestApi.analyze(request.id);
          set((state) => ({
            analyses: { ...state.analyses, [request.id]: analysis },
            loading: false
          }));
          useRequestStore.getState().setRequestStatus(request.id, "analyzed");
          return analysis;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể phân tích request.";
          set({ error: message, loading: false });
          useRequestStore.getState().setRequestStatus(request.id, "failed", message);
          throw error;
        }
      },

      async generateMaster(project, request) {
        set({ loading: true, error: undefined });
        try {
          const analysis = get().analyses[request.id] ?? (await get().analyzeRequest(project, request));
          const masterPrompt = useMockApi
            ? generateMasterPrompt(project, request, analysis)
            : await requestApi.generateMasterPrompt(request.id);

          set((state) => ({
            masterPrompts: { ...state.masterPrompts, [request.id]: masterPrompt },
            loading: false
          }));
          useRequestStore.getState().setRequestStatus(request.id, "prompted");
          return masterPrompt;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể sinh prompt tổng.";
          set({ error: message, loading: false });
          useRequestStore.getState().setRequestStatus(request.id, "failed", message);
          throw error;
        }
      },

      async splitTasks(project, request) {
        set({ loading: true, error: undefined });
        try {
          const analysis = get().analyses[request.id] ?? (await get().analyzeRequest(project, request));
          const master = get().masterPrompts[request.id] ?? (await get().generateMaster(project, request));
          const result = useMockApi
            ? splitPromptIntoTasks(project, request, analysis, master)
            : await requestApi.splitTasks(request.id);

          const treeIssues = validateTaskTree(result.root);
          const root = treeIssues.length
            ? { ...result.root, warnings: [...result.root.warnings, ...treeIssues.map((issue) => issue.message)] }
            : result.root;
          const firstPrompt = result.orderedPrompts[0];

          set((state) => ({
            taskTrees: { ...state.taskTrees, [request.id]: root },
            selectedTaskIdByRequest: {
              ...state.selectedTaskIdByRequest,
              [request.id]: firstPrompt?.id
            },
            loading: false
          }));
          useRequestStore.getState().setRequestStatus(request.id, "split");
          return root;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể chia task.";
          set({ error: message, loading: false });
          useRequestStore.getState().setRequestStatus(request.id, "failed", message);
          throw error;
        }
      },

      splitMore(requestId, taskInternalId) {
        const root = get().taskTrees[requestId];
        if (!root) return;

        const updatedRoot = updateTaskInTree(root, taskInternalId, splitTaskMore);
        set((state) => ({
          taskTrees: { ...state.taskTrees, [requestId]: updatedRoot },
          selectedTaskIdByRequest: {
            ...state.selectedTaskIdByRequest,
            [requestId]: taskInternalId
          }
        }));
      },

      updateMasterPrompt(requestId, content) {
        const current = get().masterPrompts[requestId];
        if (!current) return;

        set((state) => ({
          masterPrompts: {
            ...state.masterPrompts,
            [requestId]: {
              ...current,
              content,
              validationIssues: validateMasterPrompt(content),
              updatedAt: nowIso()
            }
          }
        }));
      },

      saveVersion(requestId, note) {
        const current = get().masterPrompts[requestId];
        if (!current) return;

        const version: PromptVersion = {
          id: createId("version"),
          requestId,
          masterPromptId: current.id,
          version: current.version + 1,
          content: current.content,
          note,
          createdAt: nowIso()
        };

        set((state) => ({
          versions: [version, ...state.versions],
          masterPrompts: {
            ...state.masterPrompts,
            [requestId]: {
              ...current,
              version: current.version + 1,
              updatedAt: nowIso()
            }
          }
        }));
      },

      selectTask(requestId, taskInternalId) {
        set((state) => ({
          selectedTaskIdByRequest: {
            ...state.selectedTaskIdByRequest,
            [requestId]: taskInternalId
          }
        }));
      },

      getOrderedPrompts(requestId) {
        return getOrderedExecutableTasks(get().taskTrees[requestId]);
      },

      getSelectedTask(requestId) {
        const selectedId = get().selectedTaskIdByRequest[requestId];
        return findTaskById(get().taskTrees[requestId], selectedId);
      }
    }),
    {
      name: "promptflow-prompts"
    }
  )
);
