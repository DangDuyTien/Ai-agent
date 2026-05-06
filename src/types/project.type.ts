export type ProjectStatus = "active" | "planning" | "paused" | "archived";
export type ProjectSourceType = "blank" | "local_path" | "git_repository";
export type ProjectScanStatus = "idle" | "scanning" | "scanned" | "failed";

export interface ProjectContext {
  id: string;
  projectId: string;
  overview: string;
  technologies: string[];
  folderStructure?: string;
  architectureNotes?: string;
  constraints?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  status: ProjectStatus;
  sourceType: ProjectSourceType;
  sourceLocation?: string;
  localRunPath?: string;
  localFolderName?: string;
  scanStatus: ProjectScanStatus;
  lastScannedAt?: string;
  context?: ProjectContext;
  requestsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFormValues {
  name: string;
  sourceType: ProjectSourceType;
  sourceLocation?: string;
  localRunPath?: string;
  localFolderName?: string;
  description: string;
  technologies: string;
  overview: string;
  folderStructure?: string;
  architectureNotes?: string;
}
