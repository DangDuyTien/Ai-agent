import { CheckCircle2, Clipboard, FileDown, GitPullRequestArrow, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { AiAnalysis, MasterPrompt } from "../../types/prompt.type";
import type { Project } from "../../types/project.type";
import type { AiRequest } from "../../types/request.type";
import type { PromptTask } from "../../types/task.type";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { exportPromptFile } from "../../utils/exportFile";
import { validateTaskPrompt } from "../../utils/validatePrompt";
import { DifficultyBadge } from "../tasks/DifficultyBadge";
import { TaskStatusBadge } from "../tasks/TaskStatusBadge";
import { TaskRunControls } from "./TaskRunControls";

interface TaskPromptPanelProps {
  request: AiRequest;
  project: Project;
  analysis?: AiAnalysis;
  masterPrompt?: MasterPrompt;
  task?: PromptTask;
  taskTree?: PromptTask;
  orderedPrompts: PromptTask[];
}

export function TaskPromptPanel({ request, project, analysis, masterPrompt, task, taskTree, orderedPrompts }: TaskPromptPanelProps) {
  const [copied, setCopied] = useState(false);
  const issues = useMemo(() => (task ? validateTaskPrompt(task) : []), [task]);

  async function handleCopy() {
    if (!task) return;
    await copyToClipboard(task.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!task) {
    return (
      <aside className="rounded-md border border-line bg-white p-4 text-sm text-muted">
        Chọn một task trong cây để xem prompt riêng.
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-[520px] flex-col rounded-md border border-line bg-white shadow-sm">
      <div className="border-b border-line p-4">
        <div className="flex items-start gap-2">
          <GitPullRequestArrow className="mt-1 h-4 w-4 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted">{task.taskId}</p>
            <h2 className="mt-1 text-base font-semibold text-ink">{task.title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted">{task.description}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <DifficultyBadge difficulty={task.difficulty} />
          <TaskStatusBadge status={task.status} />
        </div>
      </div>

      {issues.length ? (
        <div className="space-y-2 border-b border-line p-3">
          {issues.map((issue) => (
            <p key={issue.id} className="flex gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      <TaskRunControls project={project} task={task} />

      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
          {copied ? "Copied" : "Copy prompt"}
        </button>
        <button
          type="button"
          onClick={() =>
            exportPromptFile("txt", {
              request,
              analysis,
              masterPrompt,
              taskTree,
              orderedPrompts: [task]
            })
          }
          className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
        >
          <FileDown className="h-4 w-4" />
          TXT
        </button>
        <button
          type="button"
          onClick={() =>
            exportPromptFile("markdown", {
              request,
              analysis,
              masterPrompt,
              taskTree,
              orderedPrompts: [task]
            })
          }
          className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
        >
          Markdown
        </button>
        <button
          type="button"
          onClick={() =>
            exportPromptFile("json", {
              request,
              analysis,
              masterPrompt,
              taskTree,
              orderedPrompts: [task]
            })
          }
          className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
        >
          JSON
        </button>
      </div>

      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-50">
        {task.prompt}
      </pre>
    </aside>
  );
}
