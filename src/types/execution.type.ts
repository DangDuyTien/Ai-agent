export type ExecutionStatus =
  | "idle"
  | "preparing"
  | "opening_terminal"
  | "running"
  | "done"
  | "failed"
  | "stopped";

export interface TaskExecution {
  executionId: string;
  taskInternalId: string;
  taskId: string;
  title: string;
  status: ExecutionStatus;
  currentStep: string;
  workspaceDir: string;
  terminalCommand?: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

export interface RunTaskPayload {
  taskInternalId: string;
  taskId: string;
  title: string;
  prompt: string;
  workspaceDir: string;
  folderName?: string;
}
