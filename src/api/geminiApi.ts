import axiosClient from "./axiosClient";
import type { AiAnalysis } from "../types/prompt.type";

export interface GeminiAnalyzePayload {
  requestId: string;
  originalPrompt: string;
  projectContext?: string;
  technologies: string[];
  taskType: string;
  targetGoal?: string;
}

export const geminiApi = {
  async analyzeViaBackend(payload: GeminiAnalyzePayload): Promise<AiAnalysis> {
    const response = await axiosClient.post<AiAnalysis>(`/requests/${payload.requestId}/analyze`, payload);
    return response.data;
  }
};
