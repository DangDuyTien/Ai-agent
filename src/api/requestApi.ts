import axiosClient from "./axiosClient";
import type { AiAnalysis, MasterPrompt } from "../types/prompt.type";
import type { AiRequest, CreateRequestInput } from "../types/request.type";
import type { PromptTask, TaskTreeResult } from "../types/task.type";

export const requestApi = {
  async create(projectId: string, input: Omit<CreateRequestInput, "projectId">): Promise<AiRequest> {
    const response = await axiosClient.post<AiRequest>(`/projects/${projectId}/requests`, input);
    return response.data;
  },

  async analyze(requestId: string): Promise<AiAnalysis> {
    const response = await axiosClient.post<AiAnalysis>(`/requests/${requestId}/analyze`);
    return response.data;
  },

  async generateMasterPrompt(requestId: string): Promise<MasterPrompt> {
    const response = await axiosClient.post<MasterPrompt>(`/requests/${requestId}/generate-master-prompt`);
    return response.data;
  },

  async splitTasks(requestId: string): Promise<TaskTreeResult> {
    const response = await axiosClient.post<TaskTreeResult>(`/requests/${requestId}/split-tasks`);
    return response.data;
  },

  async generateTaskPrompt(taskId: string): Promise<PromptTask> {
    const response = await axiosClient.post<PromptTask>(`/tasks/${taskId}/generate-prompt`);
    return response.data;
  },

  async splitMore(taskId: string): Promise<PromptTask> {
    const response = await axiosClient.post<PromptTask>(`/tasks/${taskId}/split-more`);
    return response.data;
  },

  async getProjectTasks(projectId: string): Promise<PromptTask[]> {
    const response = await axiosClient.get<PromptTask[]>(`/projects/${projectId}/tasks`);
    return response.data;
  },

  async getPrompts(requestId: string): Promise<{
    analysis?: AiAnalysis;
    masterPrompt?: MasterPrompt;
    taskTree?: PromptTask;
    orderedPrompts?: PromptTask[];
  }> {
    const response = await axiosClient.get(`/requests/${requestId}/prompts`);
    return response.data;
  }
};
