import { CalendarDays, Database, FileCode2, FileText, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Project } from "../../types/project.type";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const technologies = Array.isArray(project.technologies) ? project.technologies : [];
  const requestsCount = typeof project.requestsCount === "number" ? project.requestsCount : 0;
  const updatedAt = project.updatedAt ? new Date(project.updatedAt) : new Date();

  return (
    <article className="rounded-md border border-line bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/projects/${project.id}`} className="block truncate text-base font-semibold text-ink hover:text-brand">
            {project.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{project.description || "Chưa có mô tả."}</p>
        </div>
        <div className="group relative">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-ink"
            aria-label="Project actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          <div className="invisible absolute right-0 z-10 mt-1 w-36 rounded-md border border-line bg-white p-1 opacity-0 shadow-panel transition group-hover:visible group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(project)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-slate-100"
            >
              <Pencil className="h-3.5 w-3.5" />
              Sửa
            </button>
            <button
              type="button"
              onClick={() => onDelete(project.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xoá
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {technologies.slice(0, 5).map((technology) => (
          <span key={technology} className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
            {technology}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" />
          {project.status}
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {requestsCount} request
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {updatedAt.toLocaleDateString("vi-VN")}
        </span>
      </div>
      {project.sourceType && project.sourceType !== "blank" ? (
        <p className="mt-3 flex min-w-0 items-center gap-1.5 truncate border-t border-line pt-3 text-xs text-muted">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{project.sourceLocation || "Chưa nhập nguồn code"}</span>
        </p>
      ) : null}
    </article>
  );
}
