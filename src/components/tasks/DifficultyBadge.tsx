import type { TaskDifficulty } from "../../types/task.type";

const difficultyClass: Record<TaskDifficulty, string> = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  hard: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-red-200 bg-red-50 text-red-700"
};

export function DifficultyBadge({ difficulty }: { difficulty: TaskDifficulty }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${difficultyClass[difficulty]}`}>
      {difficulty}
    </span>
  );
}
