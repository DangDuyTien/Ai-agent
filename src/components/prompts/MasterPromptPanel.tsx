import { CheckCircle2, Clipboard, Save } from "lucide-react";
import { useState } from "react";
import type { MasterPrompt } from "../../types/prompt.type";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { EmptyState } from "../common/EmptyState";

interface MasterPromptPanelProps {
  masterPrompt?: MasterPrompt;
  onGenerate: () => void;
  onChange: (content: string) => void;
  onSaveVersion: () => void;
}

export function MasterPromptPanel({ masterPrompt, onGenerate, onChange, onSaveVersion }: MasterPromptPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!masterPrompt) return;
    await copyToClipboard(masterPrompt.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!masterPrompt) {
    return (
      <EmptyState
        title="Chưa có prompt tổng"
        description="Sinh master prompt sau khi có bản phân tích AI."
        action={
          <button type="button" onClick={onGenerate} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            Generate Master Prompt
          </button>
        }
      />
    );
  }

  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">B. Prompt tổng chi tiết</h2>
          <p className="mt-1 text-sm text-muted">Version {masterPrompt.version}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onSaveVersion}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
          >
            <Save className="h-4 w-4" />
            Lưu version
          </button>
        </div>
      </div>

      {masterPrompt.validationIssues.length ? (
        <div className="mt-3 space-y-2">
          {masterPrompt.validationIssues.map((issue) => (
            <p
              key={issue.id}
              className={`rounded border px-3 py-2 text-sm ${
                issue.severity === "danger"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : issue.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      <textarea
        value={masterPrompt.content}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 min-h-[360px] w-full rounded-md border border-line bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-50 outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
      />
    </section>
  );
}
