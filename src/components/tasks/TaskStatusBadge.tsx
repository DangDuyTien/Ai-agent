import type { TaskStatus } from "../../types/task.type";

const statusClass: Record<TaskStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-600",
  ready: "border-blue-200 bg-blue-50 text-blue-700",
  running: "border-violet-200 bg-violet-50 text-violet-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700"
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`rounded border px-2 py-0.5 text-xs font-medium ${statusClass[status]}`}>{status}</span>;
}
