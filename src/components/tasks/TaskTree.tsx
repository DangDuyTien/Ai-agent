import type { PromptTask } from "../../types/task.type";
import { EmptyState } from "../common/EmptyState";
import { TaskNode } from "./TaskNode";

interface TaskTreeProps {
  root?: PromptTask;
  selectedTaskId?: string;
  onSelect: (task: PromptTask) => void;
  onSplitMore: (task: PromptTask) => void;
}

export function TaskTree({ root, selectedTaskId, onSelect, onSplitMore }: TaskTreeProps) {
  if (!root) {
    return (
      <EmptyState
        title="Chưa có task tree"
        description="Bấm Split Tasks sau khi có bản phân tích và master prompt."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-line bg-white p-3 text-xs text-muted">
        Level 1: Goal · Level 2: Module · Level 3: Task · Level 4: Prompt thực thi
      </div>
      <ul className="space-y-2">
        <TaskNode task={root} selectedTaskId={selectedTaskId} onSelect={onSelect} onSplitMore={onSplitMore} />
      </ul>
    </div>
  );
}
