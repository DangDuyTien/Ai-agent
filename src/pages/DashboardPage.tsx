import { Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { ProjectForm } from "../components/projects/ProjectForm";
import { ProjectList } from "../components/projects/ProjectList";
import { useProjectStore } from "../store/projectStore";
import type { Project } from "../types/project.type";

export function DashboardPage() {
  const { projects, loading, createProject, updateProject, deleteProject } = useProjectStore();
  const [showForm, setShowForm] = useState(projects.length === 0);
  const [editingProject, setEditingProject] = useState<Project>();

  async function handleDelete(projectId: string) {
    if (window.confirm("Xoá project này và dữ liệu local liên quan?")) {
      await deleteProject(projectId);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Project"
        description="Quản lý project, context, công nghệ và lịch sử request/prompt của PromptFlow Agent."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingProject(undefined);
              setShowForm((current) => !current);
            }}
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Project mới
          </button>
        }
      />

      {showForm || editingProject ? (
        <ProjectForm
          initialProject={editingProject}
          loading={loading}
          onCancel={() => {
            setShowForm(false);
            setEditingProject(undefined);
          }}
          onSubmit={async (values) => {
            if (editingProject) {
              await updateProject(editingProject.id, values);
            } else {
              await createProject(values);
            }
            setShowForm(false);
            setEditingProject(undefined);
          }}
        />
      ) : null}

      <ProjectList
        projects={projects}
        onEdit={(project) => {
          setEditingProject(project);
          setShowForm(false);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}
