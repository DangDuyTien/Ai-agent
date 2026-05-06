import { create } from "zustand";
import { persist } from "zustand/middleware";
import { requestApi } from "../api/requestApi";
import type { AiRequest, AiRequestStatus, CreateRequestInput } from "../types/request.type";
import { createId, nowIso } from "../utils/id";
import { useProjectStore } from "./projectStore";

const useMockApi = import.meta.env.VITE_USE_MOCK_API !== "false";

interface RequestState {
  requests: AiRequest[];
  loading: boolean;
  error?: string;
  createRequest: (input: CreateRequestInput) => Promise<AiRequest>;
  setRequestStatus: (requestId: string, status: AiRequestStatus, error?: string) => void;
}

export const useRequestStore = create<RequestState>()(
  persist(
    (set) => ({
      requests: [],
      loading: false,

      async createRequest(input) {
        set({ loading: true, error: undefined });
        try {
          const request = useMockApi
            ? createLocalRequest(input)
            : await requestApi.create(input.projectId, {
                originalPrompt: input.originalPrompt,
                taskType: input.taskType,
                modelStrength: input.modelStrength,
                splitLevel: input.splitLevel
              });

          set((state) => ({
            requests: [request, ...state.requests],
            loading: false
          }));

          useProjectStore.getState().incrementProjectRequests(input.projectId);
          return request;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể tạo request.";
          set({ error: message, loading: false });
          throw error;
        }
      },

      setRequestStatus(requestId, status, error) {
        set((state) => ({
          requests: state.requests.map((request) =>
            request.id === requestId ? { ...request, status, error, updatedAt: nowIso() } : request
          )
        }));
      }
    }),
    {
      name: "promptflow-requests",
      merge: (persistedState, currentState) => {
        const persisted = persistedState as PersistedRequestState;
        return {
          ...currentState,
          ...persisted,
          requests: Array.isArray(persisted.requests) ? persisted.requests : [],
          loading: false,
          error: undefined
        };
      }
    }
  )
);

type PersistedRequestState = Partial<RequestState> & {
  requests?: unknown;
};

function createLocalRequest(input: CreateRequestInput): AiRequest {
  const now = nowIso();

  return {
    id: createId("request"),
    projectId: input.projectId,
    originalPrompt: input.originalPrompt.trim(),
    taskType: input.taskType,
    modelStrength: input.modelStrength,
    splitLevel: input.splitLevel,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };
}
