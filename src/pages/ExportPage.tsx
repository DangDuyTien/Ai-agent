import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { ExportButtons } from "../components/prompts/ExportButtons";
import { useProjectStore } from "../store/projectStore";
import { usePromptStore } from "../store/promptStore";
import { useRequestStore } from "../store/requestStore";

export function ExportPage() {
  const { projectId } = useParams();
  const project = useProjectStore((state) => state.projects.find((item) => item.id === projectId));
  const allRequests = useRequestStore((state) => state.requests);
  const { analyses, masterPrompts, taskTrees, getOrderedPrompts } = usePromptStore();
  const requests = useMemo(
    () => allRequests.filter((request) => request.projectId === projectId),
    [allRequests, projectId]
  );

  const latestRequest = requests[0];
  const exportData = useMemo(() => {
    if (!latestRequest) return undefined;
    return {
      request: latestRequest,
      analysis: analyses[latestRequest.id],
      masterPrompt: masterPrompts[latestRequest.id],
      taskTree: taskTrees[latestRequest.id],
      orderedPrompts: getOrderedPrompts(latestRequest.id)
    };
  }, [analyses, getOrderedPrompts, latestRequest, masterPrompts, taskTrees]);

  if (!project) {
    return <EmptyState title="Không tìm thấy project" description="Không thể export khi thiếu project." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Export Page" description={`Xuất prompt, task tree và analysis của project ${project.name}.`} />

      {exportData ? (
        <section className="rounded-md border border-line bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Request mới nhất</h2>
          <p className="mt-1 text-sm text-muted">{exportData.request.originalPrompt}</p>
          <div className="mt-4">
            <ExportButtons {...exportData} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Metric label="Analysis" value={exportData.analysis ? "Sẵn sàng" : "Chưa có"} />
            <Metric label="Master prompt" value={exportData.masterPrompt ? `v${exportData.masterPrompt.version}` : "Chưa có"} />
            <Metric label="Prompt nhỏ" value={`${exportData.orderedPrompts.length}`} />
          </div>
        </section>
      ) : (
        <EmptyState title="Chưa có dữ liệu export" description="Tạo request và split tasks trước khi export." />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
