import { FileDown, GitBranch, WandSparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AnalysisPanel } from "../components/prompts/AnalysisPanel";
import { ExportButtons } from "../components/prompts/ExportButtons";
import { MasterPromptPanel } from "../components/prompts/MasterPromptPanel";
import { TaskPromptPanel } from "../components/prompts/TaskPromptPanel";
import { TaskTree } from "../components/tasks/TaskTree";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { useProjectStore } from "../store/projectStore";
import { usePromptStore } from "../store/promptStore";
import { useRequestStore } from "../store/requestStore";
import type { PromptTask } from "../types/task.type";

export function PromptResultPage() {
  const { requestId } = useParams();
  const request = useRequestStore((state) => state.requests.find((item) => item.id === requestId));
  const project = useProjectStore((state) => state.projects.find((item) => item.id === request?.projectId));
  const {
    analyses,
    masterPrompts,
    taskTrees,
    selectedTaskIdByRequest,
    loading,
    error,
    analyzeRequest,
    generateMaster,
    splitTasks,
    splitMore,
    updateMasterPrompt,
    saveVersion,
    selectTask,
    getOrderedPrompts,
    getSelectedTask
  } = usePromptStore();

  if (!request || !requestId || !project) {
    return <EmptyState title="Không tìm thấy request" description="Request này không tồn tại trong local state hiện tại." />;
  }

  const analysis = analyses[request.id];
  const masterPrompt = masterPrompts[request.id];
  const taskTree = taskTrees[request.id];
  const selectedTask = getSelectedTask(request.id);
  const orderedPrompts = getOrderedPrompts(request.id);

  async function handleAnalyze() {
    await analyzeRequest(project!, request!);
  }

  async function handleGenerateMaster() {
    await generateMaster(project!, request!);
  }

  async function handleSplitTasks() {
    await splitTasks(project!, request!);
  }

  function handleSelectTask(task: PromptTask) {
    selectTask(request!.id, task.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompt Result"
        description={request.originalPrompt}
        actions={
          <>
            <ExportButtons
              request={request}
              analysis={analysis}
              masterPrompt={masterPrompt}
              taskTree={taskTree}
              orderedPrompts={orderedPrompts}
            />
            <Link
              to={`/projects/${project.id}/export`}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
            >
              <FileDown className="h-4 w-4" />
              Export Page
            </Link>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <AnalysisPanel analysis={analysis} loading={loading && !analysis} error={error} onRegenerate={handleAnalyze} />
          <MasterPromptPanel
            masterPrompt={masterPrompt}
            onGenerate={handleGenerateMaster}
            onChange={(content) => updateMasterPrompt(request.id, content)}
            onSaveVersion={() => saveVersion(request.id, "Manual save from UI")}
          />

          <section className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">C. Cây task phân cấp</h2>
                <p className="mt-1 text-sm text-muted">Task được xếp theo phụ thuộc: database, backend, frontend, test.</p>
              </div>
              <button
                type="button"
                onClick={handleSplitTasks}
                className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <GitBranch className="h-4 w-4" />
                Split Tasks
              </button>
            </div>
            <div className="mt-4">
              <TaskTree
                root={taskTree}
                selectedTaskId={selectedTaskIdByRequest[request.id]}
                onSelect={handleSelectTask}
                onSplitMore={(task) => splitMore(request.id, task.id)}
              />
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <WandSparkles className="h-4 w-4 text-muted" />
              <h2 className="text-base font-semibold text-ink">D. Prompt nhỏ theo thứ tự chạy</h2>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {orderedPrompts.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleSelectTask(task)}
                  className="rounded-md border border-line bg-slate-50 px-3 py-2 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="font-mono text-xs text-muted">{task.taskId}</span>
                  <span className="ml-2 font-medium text-ink">{task.title}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <TaskPromptPanel
          request={request}
          project={project}
          analysis={analysis}
          masterPrompt={masterPrompt}
          task={selectedTask}
          taskTree={taskTree}
          orderedPrompts={orderedPrompts}
        />
      </div>
    </div>
  );
}
