import type { PromptValidationIssue } from "../types/prompt.type";
import type { PromptTask } from "../types/task.type";
import { createId } from "./id";

const AMBIGUOUS_WORDS = ["vân vân", "etc", "tùy", "đại khái", "như cũ", "hợp lý"];
const RISK_WORDS = ["xoá", "reset", "toàn bộ", "migration", "permission", "payment", "auth", "deploy"];

export function validateMasterPrompt(content: string, maxWords = 2400): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];
  const wordCount = countWords(content);

  if (wordCount > maxWords) {
    issues.push(issue("warning", `Prompt tổng dài ${wordCount} từ, nên tách thêm trước khi đưa cho model yếu.`));
  }

  if (AMBIGUOUS_WORDS.some((word) => content.toLowerCase().includes(word))) {
    issues.push(issue("warning", "Prompt có từ ngữ mơ hồ, nên bổ sung phạm vi và tiêu chí hoàn thành."));
  }

  if (RISK_WORDS.some((word) => content.toLowerCase().includes(word))) {
    issues.push(issue("info", "Prompt có khu vực rủi ro cao, nên yêu cầu backup/test trước khi sửa."));
  }

  if (!content.includes("Không được phá vỡ")) {
    issues.push(issue("info", "Nên có mục bảo vệ code cũ: không đổi API public, schema hoặc luồng hiện có nếu không cần."));
  }

  return issues;
}

export function validateTaskPrompt(task: PromptTask, maxWords = 650): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];
  const wordCount = countWords(task.prompt);

  if (wordCount > maxWords) {
    issues.push(issue("warning", `Prompt task ${task.taskId} dài ${wordCount} từ, nên split more.`));
  }

  if (task.difficulty === "critical") {
    issues.push(issue("danger", `Task ${task.taskId} là critical, cần review thủ công trước khi cho AI sửa code.`));
  }

  if (!task.prompt.includes("Không được làm")) {
    issues.push(issue("warning", `Task ${task.taskId} thiếu phần "Không được làm".`));
  }

  if (!task.prompt.includes("Sau khi làm xong")) {
    issues.push(issue("warning", `Task ${task.taskId} thiếu yêu cầu báo cáo file đã sửa và cách test.`));
  }

  return issues;
}

export function validateTaskTree(root: PromptTask): PromptValidationIssue[] {
  const flat = flatten(root);
  const taskIds = new Set(flat.map((task) => task.taskId));
  const issues: PromptValidationIssue[] = [];

  flat.forEach((task) => {
    task.depends_on.forEach((dependency) => {
      if (!taskIds.has(dependency)) {
        issues.push(issue("danger", `Task ${task.taskId} phụ thuộc ${dependency}, nhưng task đó không tồn tại.`));
      }
    });
  });

  return issues;
}

function issue(severity: PromptValidationIssue["severity"], message: string): PromptValidationIssue {
  return {
    id: createId("issue"),
    severity,
    message
  };
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function flatten(task: PromptTask): PromptTask[] {
  return [task, ...(task.children?.flatMap((child) => flatten(child)) ?? [])];
}
