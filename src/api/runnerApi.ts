import axios from "axios";
import type { RunTaskPayload, TaskExecution } from "../types/execution.type";

const runnerClient = axios.create({
  baseURL: import.meta.env.VITE_LOCAL_RUNNER_URL || "http://127.0.0.1:8787",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json"
  }
});

runnerClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Không kết nối được local runner.";

    return Promise.reject(new Error(message));
  }
);

export const runnerApi = {
  async health(): Promise<{ ok: boolean; codexPath?: string }> {
    const response = await runnerClient.get("/health");
    return response.data;
  },

  async run(payload: RunTaskPayload): Promise<TaskExecution> {
    const response = await runnerClient.post<TaskExecution>("/run", payload);
    return response.data;
  },

  async resolveWorkspace(payload: { workspaceDir?: string; folderName?: string }): Promise<{
    ok: boolean;
    workspaceDir: string;
    requestedWorkspace?: string;
    folderName?: string;
  }> {
    const response = await runnerClient.post("/resolve-workspace", payload);
    return response.data;
  },

  async status(executionId: string): Promise<TaskExecution> {
    const response = await runnerClient.get<TaskExecution>(`/status/${executionId}`);
    return response.data;
  },

  async stop(executionId: string): Promise<TaskExecution> {
    const response = await runnerClient.post<TaskExecution>(`/stop/${executionId}`);
    return response.data;
  }
};
