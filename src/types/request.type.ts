export type TaskType =
  | "feature"
  | "bugfix"
  | "ui"
  | "refactor"
  | "optimization"
  | "document"
  | "analysis";

export type RequestedTaskType = "auto" | TaskType;

export type ModelStrength = "weak" | "medium" | "strong";

export type SplitLevel = "normal" | "detailed" | "very_detailed";

export type AiRequestStatus =
  | "draft"
  | "analyzing"
  | "analyzed"
  | "prompted"
  | "split"
  | "failed";

export interface AiRequest {
  id: string;
  projectId: string;
  originalPrompt: string;
  taskType: RequestedTaskType;
  modelStrength: ModelStrength;
  splitLevel: SplitLevel;
  status: AiRequestStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestInput {
  projectId: string;
  originalPrompt: string;
  taskType: RequestedTaskType;
  modelStrength: ModelStrength;
  splitLevel: SplitLevel;
}
