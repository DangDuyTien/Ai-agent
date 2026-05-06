import type { TaskType } from "./request.type";

export interface AiAnalysis {
  id: string;
  requestId: string;
  summary: string;
  task_type: TaskType;
  main_goal: string;
  scope: string[];
  requirements: string[];
  risks: string[];
  related_modules: string[];
  output_expectation: string;
  rawJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PromptValidationIssue {
  id: string;
  severity: "info" | "warning" | "danger";
  message: string;
}

export interface MasterPrompt {
  id: string;
  requestId: string;
  content: string;
  version: number;
  validationIssues: PromptValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  requestId: string;
  masterPromptId: string;
  version: number;
  content: string;
  note?: string;
  createdAt: string;
}

export interface PromptBundle {
  analysis?: AiAnalysis;
  masterPrompt?: MasterPrompt;
  taskCount: number;
}
