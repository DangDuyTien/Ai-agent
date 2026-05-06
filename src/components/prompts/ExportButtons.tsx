import { FileArchive, FileJson, FileText } from "lucide-react";
import type { AiAnalysis, MasterPrompt } from "../../types/prompt.type";
import type { AiRequest } from "../../types/request.type";
import type { PromptTask } from "../../types/task.type";
import { exportPromptFile } from "../../utils/exportFile";

interface ExportButtonsProps {
  request: AiRequest;
  analysis?: AiAnalysis;
  masterPrompt?: MasterPrompt;
  taskTree?: PromptTask;
  orderedPrompts: PromptTask[];
}

export function ExportButtons({ request, analysis, masterPrompt, taskTree, orderedPrompts }: ExportButtonsProps) {
  const payload = { request, analysis, masterPrompt, taskTree, orderedPrompts };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => exportPromptFile("json", payload)}
        className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
      >
        <FileJson className="h-4 w-4" />
        Export JSON
      </button>
      <button
        type="button"
        onClick={() => exportPromptFile("markdown", payload)}
        className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
      >
        <FileText className="h-4 w-4" />
        Export Markdown
      </button>
      <button
        type="button"
        onClick={() => exportPromptFile("txt", payload)}
        className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
      >
        <FileArchive className="h-4 w-4" />
        Export TXT
      </button>
    </div>
  );
}
