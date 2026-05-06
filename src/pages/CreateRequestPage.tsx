import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { RequestForm } from "../components/requests/RequestForm";
import { useProjectStore } from "../store/projectStore";
import { usePromptStore } from "../store/promptStore";
import { useRequestStore } from "../store/requestStore";
import type { CreateRequestInput } from "../types/request.type";

export function CreateRequestPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = useProjectStore((state) => state.projects.find((item) => item.id === projectId));
  const createRequest = useRequestStore((state) => state.createRequest);
  const requestLoading = useRequestStore((state) => state.loading);
  const { analyzeRequest, generateMaster, splitTasks, loading: promptLoading } = usePromptStore();

  if (!project || !projectId) {
    return <EmptyState title="Không tìm thấy project" description="Cần có project trước khi tạo request." />;
  }

  async function handleSubmit(input: CreateRequestInput) {
    const request = await createRequest(input);
    await analyzeRequest(project!, request);
    await generateMaster(project!, request);
    await splitTasks(project!, request);
    navigate(`/requests/${request.id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Request"
        description="Chỉ cần nhập yêu cầu ngắn. PromptFlow Agent sẽ tự phân tích loại task, scope, rủi ro, master prompt và task tree."
      />
      <RequestForm projectId={projectId} loading={requestLoading || promptLoading} onSubmit={handleSubmit} />
    </div>
  );
}
