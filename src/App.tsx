import { FolderKanban, LayoutDashboard, Plus, Workflow } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { CreateRequestPage } from "./pages/CreateRequestPage";
import { PromptResultPage } from "./pages/PromptResultPage";
import { ExportPage } from "./pages/ExportPage";
import { useProjectStore } from "./store/projectStore";

export default function App() {
  return (
    <AppErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/requests/new" element={<CreateRequestPage />} />
          <Route path="/projects/:projectId/export" element={<ExportPage />} />
          <Route path="/requests/:requestId" element={<PromptResultPage />} />
        </Route>
      </Routes>
    </AppErrorBoundary>
  );
}

function AppShell() {
  const projects = useProjectStore((state) => state.projects);
  const safeProjects = Array.isArray(projects) ? projects : [];

  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-line bg-white p-4 lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-white">
            <Workflow className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink">PromptFlow Agent</span>
            <span className="block text-xs text-muted">AI Prompt Builder</span>
          </span>
        </Link>

        <nav className="mt-6 space-y-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? "bg-blue-50 text-brand" : "text-muted hover:bg-slate-100 hover:text-ink"
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>
        </nav>

        <div className="mt-6 flex items-center justify-between px-3">
          <p className="text-xs font-semibold uppercase text-muted">Projects</p>
          <Link to="/" className="rounded p-1 text-muted hover:bg-slate-100 hover:text-ink" aria-label="Tạo project">
            <Plus className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-auto">
          {safeProjects.map((project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-slate-900 text-white" : "text-muted hover:bg-slate-100 hover:text-ink"
                }`
              }
            >
              <FolderKanban className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{project.name || "Untitled project"}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                {typeof project.requestsCount === "number" ? project.requestsCount : 0}
              </span>
            </NavLink>
          ))}
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-white px-4 py-3 lg:hidden">
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-ink">
          <Workflow className="h-5 w-5 text-brand" />
          PromptFlow Agent
        </Link>
      </header>

      <main className="min-h-screen px-4 py-6 lg:ml-72 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

interface AppErrorBoundaryState {
  error?: Error;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("PromptFlow Agent render error", error, info);
  }

  clearLocalData = () => {
    localStorage.removeItem("promptflow-projects");
    localStorage.removeItem("promptflow-requests");
    localStorage.removeItem("promptflow-prompts");
    window.location.assign("/");
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-ink">
          <div className="w-full max-w-xl rounded-md border border-red-200 bg-white p-5 shadow-panel">
            <h1 className="text-lg font-semibold text-red-800">Ứng dụng gặp lỗi khi render</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Thường do dữ liệu local cũ không còn khớp cấu trúc mới. Bạn có thể xoá dữ liệu local để tạo lại project sạch.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-red-50 p-3 text-xs text-red-800">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={this.clearLocalData}
              className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            >
              Xoá dữ liệu local và tải lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
