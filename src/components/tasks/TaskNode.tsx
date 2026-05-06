import { ChevronRight, FileCode2, GitBranch, Layers3, Target } from "lucide-react";
import type { PromptTask } from "../../types/task.type";
import { DifficultyBadge } from "./DifficultyBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";

interface TaskNodeProps {
  task: PromptTask;
  selectedTaskId?: string;
  onSelect: (task: PromptTask) => void;
  onSplitMore: (task: PromptTask) => void;
}

const iconByKind = {
  goal: Target,
  module: Layers3,
  task: GitBranch,
  prompt: FileCode2
};

export function TaskNode({ task, selectedTaskId, onSelect, onSplitMore }: TaskNodeProps) {
  const Icon = iconByKind[task.kind];
  const isSelected = selectedTaskId === task.id;
  const canSplitMore = task.kind === "task" && (task.difficulty === "hard" || task.difficulty === "critical" || task.prompt.length > 1800);

  return (
    <li className="list-none">
      <div
        className={`rounded-md border px-3 py-2 transition ${
          isSelected ? "border-blue-300 bg-blue-50" : "border-line bg-white hover:border-blue-200"
        }`}
      >
        <button type="button" onClick={() => onSelect(task)} className="flex w-full items-start gap-2 text-left">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">{task.taskId}</span>
              <span className="text-sm font-semibold text-ink">{task.title}</span>
              <DifficultyBadge difficulty={task.difficulty} />
              <TaskStatusBadge status={task.status} />
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted">{task.description}</span>
            {task.depends_on.length ? (
              <span className="mt-1 block text-xs text-slate-500">Depends on: {task.depends_on.join(", ")}</span>
            ) : null}
          </span>
          {task.children?.length ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : null}
        </button>

        {canSplitMore ? (
          <button
            type="button"
            onClick={() => onSplitMore(task)}
            className="mt-2 rounded border border-orange-200 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50"
          >
            Split more
          </button>
        ) : null}
      </div>

      {task.children?.length ? (
        <ul className="ml-4 mt-2 space-y-2 border-l border-line pl-3">
          {task.children.map((child) => (
            <TaskNode
              key={child.id}
              task={child}
              selectedTaskId={selectedTaskId}
              onSelect={onSelect}
              onSplitMore={onSplitMore}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
