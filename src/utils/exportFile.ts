import type { AiAnalysis, MasterPrompt } from "../types/prompt.type";
import type { AiRequest } from "../types/request.type";
import type { PromptTask } from "../types/task.type";

export type ExportFormat = "json" | "markdown" | "txt";

export interface ExportPayload {
  request: AiRequest;
  analysis?: AiAnalysis;
  masterPrompt?: MasterPrompt;
  taskTree?: PromptTask;
  orderedPrompts?: PromptTask[];
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function serializeExport(format: ExportFormat, payload: ExportPayload): string {
  if (format === "json") {
    return JSON.stringify(payload, null, 2);
  }

  if (format === "markdown") {
    return buildMarkdownExport(payload);
  }

  return buildTextExport(payload);
}

export function exportPromptFile(format: ExportFormat, payload: ExportPayload): void {
  const extension = format === "markdown" ? "md" : format;
  const filename = `promptflow-${payload.request.id}.${extension}`;
  const mime = format === "json" ? "application/json" : "text/plain";
  downloadTextFile(filename, serializeExport(format, payload), mime);
}

export function buildMarkdownExport(payload: ExportPayload): string {
  const lines: string[] = [
    `# PromptFlow Agent Export`,
    ``,
    `## Yêu cầu gốc`,
    payload.request.originalPrompt,
    ``
  ];

  if (payload.analysis) {
    lines.push(
      `## A. Bản phân tích yêu cầu`,
      `- **Tóm tắt:** ${payload.analysis.summary}`,
      `- **Task type:** ${payload.analysis.task_type}`,
      `- **Mục tiêu chính:** ${payload.analysis.main_goal}`,
      ``,
      `### Phạm vi`,
      ...payload.analysis.scope.map((item) => `- ${item}`),
      ``,
      `### Requirements`,
      ...payload.analysis.requirements.map((item) => `- ${item}`),
      ``,
      `### Rủi ro`,
      ...payload.analysis.risks.map((item) => `- ${item}`),
      ``
    );
  }

  if (payload.masterPrompt) {
    lines.push(`## B. Prompt tổng chi tiết`, payload.masterPrompt.content, ``);
  }

  if (payload.taskTree) {
    lines.push(`## C. Cây task phân cấp`, renderTaskMarkdown(payload.taskTree), ``);
  }

  if (payload.orderedPrompts?.length) {
    lines.push(`## D. Danh sách prompt nhỏ theo thứ tự chạy`);
    payload.orderedPrompts.forEach((task) => {
      lines.push(
        `### ${task.taskId}. ${task.title}`,
        `- **Độ khó:** ${task.difficulty}`,
        `- **Trạng thái:** ${task.status}`,
        `- **Phụ thuộc:** ${task.depends_on.length ? task.depends_on.join(", ") : "Không có"}`,
        ``,
        "```text",
        task.prompt,
        "```",
        ``
      );
    });
  }

  return lines.join("\n");
}

function buildTextExport(payload: ExportPayload): string {
  const parts: string[] = [
    "PromptFlow Agent Export",
    "",
    "Yeu cau goc:",
    payload.request.originalPrompt,
    ""
  ];

  if (payload.analysis) {
    parts.push(
      "A. Ban phan tich yeu cau",
      payload.analysis.summary,
      `Task type: ${payload.analysis.task_type}`,
      `Muc tieu: ${payload.analysis.main_goal}`,
      ""
    );
  }

  if (payload.masterPrompt) {
    parts.push("B. Prompt tong chi tiet", payload.masterPrompt.content, "");
  }

  if (payload.orderedPrompts?.length) {
    parts.push("D. Danh sach prompt nho theo thu tu chay");
    payload.orderedPrompts.forEach((task) => {
      parts.push(`${task.taskId}. ${task.title}`, task.prompt, "");
    });
  }

  return parts.join("\n");
}

function renderTaskMarkdown(task: PromptTask, depth = 0): string {
  const indent = "  ".repeat(depth);
  const line = `${indent}- **${task.taskId}** ${task.title} (${task.kind}, ${task.difficulty}, ${task.status})`;
  const children = task.children?.map((child) => renderTaskMarkdown(child, depth + 1)) ?? [];
  return [line, ...children].join("\n");
}
