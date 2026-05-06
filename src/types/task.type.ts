export type TaskDifficulty = "easy" | "medium" | "hard" | "critical";

export type TaskStatus = "pending" | "ready" | "running" | "done" | "failed";

export type TaskNodeKind = "goal" | "module" | "task" | "prompt";

export interface PromptTask {
  id: string;
  requestId: string;
  taskId: string;
  parentId?: string;
  title: string;
  description: string;
  level: 1 | 2 | 3 | 4;
  kind: TaskNodeKind;
  difficulty: TaskDifficulty;
  status: TaskStatus;
  depends_on: string[];
  relatedModules: string[];
  prompt: string;
  warnings: string[];
  acceptanceCriteria: string[];
  order: number;
  children?: PromptTask[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskTreeResult {
  root: PromptTask;
  orderedPrompts: PromptTask[];
}
