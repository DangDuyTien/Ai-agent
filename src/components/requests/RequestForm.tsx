import { ChevronDown, SendHorizonal, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { CreateRequestInput, ModelStrength, RequestedTaskType, SplitLevel } from "../../types/request.type";

interface RequestFormProps {
  projectId: string;
  loading?: boolean;
  onSubmit: (input: CreateRequestInput) => Promise<void> | void;
}

const taskTypeOptions: Array<{ label: string; value: RequestedTaskType }> = [
  { label: "Auto - để AI tự phân tích", value: "auto" },
  { label: "Feature", value: "feature" },
  { label: "Bugfix", value: "bugfix" },
  { label: "UI", value: "ui" },
  { label: "Refactor", value: "refactor" },
  { label: "Optimization", value: "optimization" },
  { label: "Document", value: "document" },
  { label: "Analysis", value: "analysis" }
];

const modelOptions: Array<{ label: string; value: ModelStrength }> = [
  { label: "Weak", value: "weak" },
  { label: "Medium", value: "medium" },
  { label: "Strong", value: "strong" }
];

const splitOptions: Array<{ label: string; value: SplitLevel }> = [
  { label: "Normal", value: "normal" },
  { label: "Detailed", value: "detailed" },
  { label: "Very Detailed", value: "very_detailed" }
];

export function RequestForm({ projectId, loading, onSubmit }: RequestFormProps) {
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [taskType, setTaskType] = useState<RequestedTaskType>("auto");
  const [modelStrength, setModelStrength] = useState<ModelStrength>("weak");
  const [splitLevel, setSplitLevel] = useState<SplitLevel>("detailed");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (originalPrompt.trim().length < 8) {
      setError("Yêu cầu cần đủ rõ, tối thiểu 8 ký tự.");
      return;
    }

    setError(undefined);
    await onSubmit({
      projectId,
      originalPrompt,
      taskType,
      modelStrength,
      splitLevel
    });
    setOriginalPrompt("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-md border border-line bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <label className="text-sm font-medium text-ink" htmlFor="request-prompt">
            Nhập yêu cầu, AI sẽ tự phân tích
          </label>
        </div>
        <textarea
          id="request-prompt"
          value={originalPrompt}
          onChange={(event) => setOriginalPrompt(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-md border border-line px-3 py-3 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
          placeholder="Ví dụ: Thêm chức năng đăng nhập bằng Google"
        />
        <p className="mt-2 text-xs leading-5 text-muted">
          Không cần chọn loại task. Nếu bạn nhập "thêm", "sửa giao diện", "fix lỗi", "tối ưu"... AI sẽ tự suy luận scope,
          module liên quan, rủi ro và cách chia task.
        </p>
      </div>

      <div className="rounded-md border border-line bg-slate-50">
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-ink"
        >
          Tuỳ chọn nâng cao
          <ChevronDown className={`h-4 w-4 text-muted transition ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced ? (
          <div className="grid gap-4 border-t border-line p-3 md:grid-cols-3">
            <Select
              label="Loại task"
              value={taskType}
              onChange={(value) => setTaskType(value as RequestedTaskType)}
              options={taskTypeOptions}
            />
            <Select
              label="Độ mạnh model"
              value={modelStrength}
              onChange={(value) => setModelStrength(value as ModelStrength)}
              options={modelOptions}
            />
            <Select
              label="Mức chia nhỏ"
              value={splitLevel}
              onChange={(value) => setSplitLevel(value as SplitLevel)}
              options={splitOptions}
            />
          </div>
        ) : (
          <p className="border-t border-line px-3 py-2 text-xs text-muted">
            Đang dùng mặc định: AI tự nhận diện loại task · Model yếu · Chia chi tiết.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <SendHorizonal className="h-4 w-4" />
          Tạo request và phân tích
        </button>
      </div>
    </form>
  );
}

function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-ink">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
