import { RefreshCw } from "lucide-react";
import type { AiAnalysis } from "../../types/prompt.type";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingState } from "../common/LoadingState";

interface AnalysisPanelProps {
  analysis?: AiAnalysis;
  loading?: boolean;
  error?: string;
  onRegenerate: () => void;
}

export function AnalysisPanel({ analysis, loading, error, onRegenerate }: AnalysisPanelProps) {
  if (loading) {
    return <LoadingState label="Đang phân tích yêu cầu bằng AI..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRegenerate} />;
  }

  if (!analysis) {
    return (
      <EmptyState
        title="Chưa có phân tích"
        description="Bấm Analyze để tạo JSON analysis từ yêu cầu gốc và context project."
        action={
          <button type="button" onClick={onRegenerate} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            Analyze
          </button>
        }
      />
    );
  }

  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">A. Bản phân tích yêu cầu</h2>
          <p className="mt-1 text-sm text-muted">{analysis.summary}</p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Info label="Task type" value={analysis.task_type} />
        <Info label="Main goal" value={analysis.main_goal} />
        <Info label="Related modules" value={analysis.related_modules.join(", ")} />
        <Info label="Output expectation" value={analysis.output_expectation} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <List title="Scope" items={analysis.scope} />
        <List title="Requirements" items={analysis.requirements} />
        <List title="Risks" items={analysis.risks} tone="risk" />
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 text-sm text-ink">{value}</p>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "risk" }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-md border px-3 py-2 text-sm leading-5 ${
              tone === "risk" ? "border-red-100 bg-red-50 text-red-800" : "border-line bg-slate-50 text-slate-700"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
