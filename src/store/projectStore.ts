import { create } from "zustand";
import { persist } from "zustand/middleware";
import { projectApi } from "../api/projectApi";
import type { Project, ProjectFormValues } from "../types/project.type";
import { createId, nowIso } from "../utils/id";

const useMockApi = import.meta.env.VITE_USE_MOCK_API !== "false";

interface ProjectState {
  projects: Project[];
  selectedProjectId?: string;
  loading: boolean;
  error?: string;
  setSelectedProject: (projectId?: string) => void;
  createProject: (values: ProjectFormValues) => Promise<Project>;
  updateProject: (projectId: string, values: ProjectFormValues) => Promise<Project>;
  scanProjectContext: (projectId: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  incrementProjectRequests: (projectId: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      loading: false,

      setSelectedProject(projectId) {
        set({ selectedProjectId: projectId });
      },

      async createProject(values) {
        set({ loading: true, error: undefined });
        try {
          const project = useMockApi ? createLocalProject(values) : await projectApi.create(values);
          set((state) => ({
            projects: [project, ...state.projects],
            selectedProjectId: project.id,
            loading: false
          }));
          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể tạo project.";
          set({ error: message, loading: false });
          throw error;
        }
      },

      async updateProject(projectId, values) {
        set({ loading: true, error: undefined });
        try {
          const updated = useMockApi ? updateLocalProject(get().projects, projectId, values) : await projectApi.update(projectId, values);
          set((state) => ({
            projects: state.projects.map((project) => (project.id === projectId ? updated : project)),
            loading: false
          }));
          return updated;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể cập nhật project.";
          set({ error: message, loading: false });
          throw error;
        }
      },

      async scanProjectContext(projectId) {
        set({ loading: true, error: undefined });
        try {
          const scanned = useMockApi ? scanLocalProjectContext(get().projects, projectId) : await projectApi.scanContext(projectId);
          set((state) => ({
            projects: state.projects.map((project) => (project.id === projectId ? scanned : project)),
            loading: false
          }));
          return scanned;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể scan context project.";
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === projectId ? { ...project, scanStatus: "failed", updatedAt: nowIso() } : project
            ),
            error: message,
            loading: false
          }));
          throw error;
        }
      },

      async deleteProject(projectId) {
        set({ loading: true, error: undefined });
        try {
          if (!useMockApi) {
            await projectApi.remove(projectId);
          }

          set((state) => ({
            projects: state.projects.filter((project) => project.id !== projectId),
            selectedProjectId: state.selectedProjectId === projectId ? undefined : state.selectedProjectId,
            loading: false
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thể xoá project.";
          set({ error: message, loading: false });
          throw error;
        }
      },

      incrementProjectRequests(projectId) {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? { ...project, requestsCount: project.requestsCount + 1, updatedAt: nowIso() }
              : project
          )
        }));
      }
    }),
    {
      name: "promptflow-projects",
      merge: (persistedState, currentState) => {
        const persisted = persistedState as PersistedProjectState;
        return {
          ...currentState,
          ...persisted,
          projects: normalizeProjects(persisted.projects),
          loading: false,
          error: undefined
        };
      }
    }
  )
);

type PersistedProjectState = Partial<ProjectState> & {
  projects?: unknown;
};

function createLocalProject(values: ProjectFormValues): Project {
  const now = nowIso();
  const projectId = createId("project");
  const technologies = parseTechnologies(values.technologies);

  return {
    id: projectId,
    name: values.name.trim(),
    description: values.description.trim(),
    technologies,
    status: "planning",
    sourceType: values.sourceType ?? "blank",
    sourceLocation: values.sourceLocation?.trim(),
    localRunPath: values.localRunPath?.trim(),
    localFolderName: values.localFolderName?.trim(),
    scanStatus: "idle",
    requestsCount: 0,
    context: {
      id: createId("context"),
      projectId,
      overview: values.overview.trim(),
      technologies,
      folderStructure: values.folderStructure?.trim(),
      architectureNotes: values.architectureNotes?.trim(),
      constraints: [],
      createdAt: now,
      updatedAt: now
    },
    createdAt: now,
    updatedAt: now
  };
}

function normalizeProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((project): project is Partial<Project> => Boolean(project) && typeof project === "object")
    .map((project) => normalizeProject(project));
}

function normalizeProject(project: Partial<Project>): Project {
  const now = nowIso();
  const id = typeof project.id === "string" ? project.id : createId("project");
  const technologies = Array.isArray(project.technologies) ? project.technologies.filter(Boolean) : [];

  return {
    id,
    name: typeof project.name === "string" && project.name.trim() ? project.name : "Untitled project",
    description: typeof project.description === "string" ? project.description : "",
    technologies,
    status: project.status ?? "planning",
    sourceType: project.sourceType ?? "blank",
    sourceLocation: typeof project.sourceLocation === "string" ? project.sourceLocation : "",
    localRunPath: typeof project.localRunPath === "string" ? project.localRunPath : "",
    localFolderName: typeof project.localFolderName === "string" ? project.localFolderName : "",
    scanStatus: project.scanStatus ?? "idle",
    lastScannedAt: project.lastScannedAt,
    requestsCount: typeof project.requestsCount === "number" ? project.requestsCount : 0,
    context: {
      id: project.context?.id ?? createId("context"),
      projectId: id,
      overview: project.context?.overview ?? "",
      technologies: Array.isArray(project.context?.technologies) ? project.context.technologies : technologies,
      folderStructure: project.context?.folderStructure ?? "",
      architectureNotes: project.context?.architectureNotes ?? "",
      constraints: Array.isArray(project.context?.constraints) ? project.context.constraints : [],
      createdAt: project.context?.createdAt ?? project.createdAt ?? now,
      updatedAt: project.context?.updatedAt ?? project.updatedAt ?? now
    },
    createdAt: project.createdAt ?? now,
    updatedAt: project.updatedAt ?? now
  };
}

function updateLocalProject(projects: Project[], projectId: string, values: ProjectFormValues): Project {
  const existing = projects.find((project) => project.id === projectId);
  if (!existing) {
    throw new Error("Không tìm thấy project.");
  }

  const technologies = parseTechnologies(values.technologies);
  const now = nowIso();

  return {
    ...existing,
    name: values.name.trim(),
    description: values.description.trim(),
    technologies,
    sourceType: values.sourceType ?? "blank",
    sourceLocation: values.sourceLocation?.trim(),
    localRunPath: values.localRunPath?.trim(),
    localFolderName: values.localFolderName?.trim(),
    context: {
      id: existing.context?.id ?? createId("context"),
      projectId,
      overview: values.overview.trim(),
      technologies,
      folderStructure: values.folderStructure?.trim(),
      architectureNotes: values.architectureNotes?.trim(),
      constraints: existing.context?.constraints ?? [],
      createdAt: existing.context?.createdAt ?? now,
      updatedAt: now
    },
    updatedAt: now
  };
}

function scanLocalProjectContext(projects: Project[], projectId: string): Project {
  const existing = projects.find((project) => project.id === projectId);
  if (!existing) {
    throw new Error("Không tìm thấy project.");
  }

  const now = nowIso();
  const inferredTechnologies = existing.technologies.length ? existing.technologies : inferTechnologiesFromLocation(existing.sourceLocation);
  const sourceType = existing.sourceType ?? "blank";
  const sourceText =
    sourceType === "blank"
      ? "Project chưa khai báo nguồn code."
      : `Nguồn project: ${existing.sourceLocation || "chưa nhập"}`;

  return {
    ...existing,
    technologies: inferredTechnologies,
    sourceType,
    scanStatus: "scanned",
    lastScannedAt: now,
    context: {
      id: existing.context?.id ?? createId("context"),
      projectId,
      overview: [
        existing.context?.overview,
        sourceText,
        "Mock scan: frontend không thể đọc trực tiếp file local. Khi nối backend/local agent, endpoint /api/projects/:id/scan-context sẽ đọc package files, routes, models, migrations, components và sinh context thật cho AI."
      ]
        .filter(Boolean)
        .join("\n\n"),
      technologies: inferredTechnologies,
      folderStructure:
        existing.context?.folderStructure ||
        [
          "Backend scan chưa nối.",
          "Dự kiến backend sẽ thu thập:",
          "- package.json / composer.json / requirements.txt",
          "- src/, app/, routes/, database/, components/, pages/",
          "- API routes, models, migrations, services, UI components"
        ].join("\n"),
      architectureNotes:
        existing.context?.architectureNotes ||
        "Với project có sẵn, AI phải đọc context scan trước, xác định file liên quan, rồi mới sinh prompt sửa/thêm chức năng.",
      constraints: existing.context?.constraints ?? [
        "Không sửa lan man ngoài phạm vi yêu cầu.",
        "Không đổi public API/schema nếu chưa có task riêng.",
        "Luôn yêu cầu liệt kê file đã sửa và cách test."
      ],
      createdAt: existing.context?.createdAt ?? now,
      updatedAt: now
    },
    updatedAt: now
  };
}

function parseTechnologies(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferTechnologiesFromLocation(sourceLocation?: string): string[] {
  const text = sourceLocation?.toLowerCase() ?? "";
  const technologies = new Set<string>();

  if (text.includes("react") || text.includes("vite") || text.includes("next")) technologies.add("React");
  if (text.includes("laravel")) technologies.add("Laravel");
  if (text.includes("node") || text.includes("express")) technologies.add("Node.js");
  if (text.includes("vue")) technologies.add("Vue");
  if (text.includes("django")) technologies.add("Django");
  if (text.includes("mobile") || text.includes("flutter")) technologies.add("Flutter");

  return technologies.size ? Array.from(technologies) : ["Chưa xác định - cần scan backend"];
}
