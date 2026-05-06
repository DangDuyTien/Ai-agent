import type { Project } from "../../types/project.type";
import { EmptyState } from "../common/EmptyState";
import { ProjectCard } from "./ProjectCard";

interface ProjectListProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectList({ projects, onEdit, onDelete }: ProjectListProps) {
  if (!projects.length) {
    return (
      <EmptyState
        title="Chưa có project"
        description="Tạo project đầu tiên để lưu context, công nghệ và lịch sử prompt."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
