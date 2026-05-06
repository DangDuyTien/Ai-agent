import { ArrowRight, FileDown, FolderSearch, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { RequestForm } from "../components/requests/RequestForm";
import { useProjectStore } from "../store/projectStore";
import { usePromptStore } from "../store/promptStore";
import { useRequestStore } from "../store/requestStore";
import type { CreateRequestInput } from "../types/request.type";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = useProjectStore((state) => state.projects.find((item) => item.id === projectId));
  const scanProjectContext = useProjectStore((state) => state.scanProjectContext);
  const projectLoading = useProjectStore((state) => state.loading);
  const allRequests = useRequestStore((state) => state.requests);
  const createRequest = useRequestStore((state) => state.createRequest);
  const requestLoading = useRequestStore((state) => state.loading);
  const { analyzeRequest, generateMaster, splitTasks, loading: promptLoading } = usePromptStore();
  const requests = useMemo(
    () => allRequests.filter((request) => request.projectId === projectId),
    [allRequests, projectId]
  );

  if (!project) {
    return <EmptyState title="Không tìm thấy project" description="Project này không tồn tại trong local state hiện tại." />;
  }

  const sourceType = project.sourceType ?? "blank";
  const technologies = Array.isArray(project.technologies) ? project.technologies : [];

  async function handleQuickRequest(input: CreateRequestInput) {
    const request = await createRequest(input);
    await analyzeRequest(project!, request);
    await generateMaster(project!, request);
    await splitTasks(project!, request);
    navigate(`/requests/${request.id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description || "Project chưa có mô tả."}
        actions={
          <>
            <Link
              to={`/projects/${project.id}/requests/new`}
              className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Tạo request
            </Link>
            <Link
              to={`/projects/${project.id}/export`}
              className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-slate-100"
            >
              <FileDown className="h-4 w-4" />
              Export
            </Link>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Context dự án</h2>
              <p className="mt-1 text-xs text-muted">
                {sourceType === "blank"
                  ? "Project lập kế hoạch, chưa liên kết codebase."
                  : `${sourceType === "local_path" ? "Local" : "Git"}: ${project.sourceLocation || "chưa nhập nguồn"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => scanProjectContext(project.id)}
              disabled={projectLoading || sourceType === "blank"}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={sourceType === "blank" ? "Cần khai báo local path hoặc repo URL trước" : "Scan codebase để cập nhật context"}
            >
              <FolderSearch className="h-4 w-4" />
              {project.scanStatus === "scanned" ? "Scan lại" : "Scan context"}
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{project.context?.overview || "Chưa có context."}</p>
          {project.lastScannedAt ? (
            <p className="mt-3 text-xs text-muted">Scan gần nhất: {new Date(project.lastScannedAt).toLocaleString("vi-VN")}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {technologies.map((technology) => (
              <span key={technology} className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {technology}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Cấu trúc thư mục</h2>
          <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-50">
            {project.context?.folderStructure || "Chưa nhập cấu trúc thư mục."}
          </pre>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-ink">Nhập yêu cầu nhanh</h2>
          <p className="mt-1 text-sm text-muted">
            Gõ một câu như "Thêm chức năng giỏ hàng" hoặc "Sửa giao diện trang chi tiết sản phẩm"; AI sẽ tự phân tích phần còn lại.
          </p>
        </div>
        <RequestForm projectId={project.id} loading={requestLoading || promptLoading} onSubmit={handleQuickRequest} />
      </section>

      <section className="rounded-md border border-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">Lịch sử request/prompt</h2>
        {requests.length ? (
          <div className="mt-4 divide-y divide-line">
            {requests.map((request) => (
              <Link
                key={request.id}
                to={`/requests/${request.id}`}
                className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{request.originalPrompt}</p>
                  <p className="mt-1 text-xs text-muted">
                    {request.taskType} · {request.modelStrength} · {request.splitLevel} · {request.status}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có request" description="Tạo request mới để Gemini/backend phân tích và sinh prompt." />
        )}
      </section>
    </div>
  );
}
