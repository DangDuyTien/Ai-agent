import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import type {
  AppliedFileEdit,
  CodeEditIteration,
  CodebaseContext,
  ExecutionPrompt,
  FileEdit
} from "@/packages/schemas/project-blueprint.schema";
import { runFileEditProvider } from "@/packages/orchestrator/llm-provider";
import { runSandboxReview } from "@/packages/orchestrator/sandbox-runner";
import { runCodexCliEditingLoop } from "@/packages/orchestrator/codex-cli-executor";

const blockedSegments = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".ai-agent"]);

export async function runCodeEditingLoop(input: {
  workspace: string;
  prompts: ExecutionPrompt[];
  codebaseContext?: CodebaseContext;
  maxIterations?: number;
  onLog?: (msg: string) => Promise<void>;
  abortCheck?: () => Promise<boolean>;
}): Promise<{ iterations: CodeEditIteration[]; changedFiles: string[] }> {
  const command = process.env.AI_AGENT_CODEX_COMMAND || "codex";
  let codexAvailable = false;
  try {
    await execFileAsync(command, ["--version"], { timeout: 5000 });
    const loginStatus = await execFileAsync(command, ["login", "status"], { timeout: 5000 });
    codexAvailable = /Logged in/i.test(`${loginStatus.stdout}\n${loginStatus.stderr}`);
  } catch {
    codexAvailable = false;
  }

  if (process.env.AI_AGENT_EXECUTOR === "codex" || codexAvailable) {
    return runCodexCliEditingLoop(input);
  }

  const maxFixIterations = input.maxIterations ?? Number(process.env.AI_AGENT_MAX_FIX_ITERATIONS || 2);
  const iterations: CodeEditIteration[] = [];
  const changedFiles = new Set<string>();
  let iterationNumber = 0;

  for (const prompt of input.prompts) {
    if (input.abortCheck && (await input.abortCheck())) {
      if (input.onLog) await input.onLog("[Hệ thống] Thực thi bị dừng bởi người dùng.");
      break;
    }
    
    let previousError: string | undefined;

    for (let attempt = 0; attempt <= maxFixIterations; attempt += 1) {
      iterationNumber += 1;
      if (input.onLog) {
        await input.onLog(`[Iter ${iterationNumber}] Gửi Prompt:\n${prompt.title}\n${previousError ? `\nLỗi trước đó:\n${previousError}` : ""}`);
      }

      const providerResult = await runFileEditProvider({
        prompt,
        workspace: input.workspace,
        codebaseContext: input.codebaseContext,
        previousError
      });

      if (input.onLog) {
        await input.onLog(`[Iter ${iterationNumber}] Kết quả từ ${providerResult.provider}:\n${providerResult.output}`);
      }

      const appliedEdits: AppliedFileEdit[] = [];
      const rejectedEdits: AppliedFileEdit[] = [];
      for (const edit of providerResult.plan.edits) {
        const result = await applyFileEdit(input.workspace, edit);
        if (result.status === "applied") {
          appliedEdits.push(result);
          changedFiles.add(result.path);
        } else {
          rejectedEdits.push(result);
        }
      }

      const sandboxResult = await runSandboxReview(input.workspace);
      const failedCommands = sandboxResult.commands.filter((command) => command.exitCode !== 0);
      const fixPrompt =
        failedCommands.length || rejectedEdits.length
          ? buildFixPrompt(failedCommands.map((command) => `${command.command}\n${command.stderr || command.stdout}`).join("\n\n"), rejectedEdits)
          : undefined;

      iterations.push({
        iteration: iterationNumber,
        promptTitle: prompt.title,
        provider: providerResult.provider,
        mode: providerResult.mode,
        summary: providerResult.plan.summary,
        appliedEdits,
        rejectedEdits,
        sandboxResult,
        fixPrompt
      });

      if (!fixPrompt) break;
      previousError = fixPrompt;
      if (attempt === maxFixIterations) return { iterations, changedFiles: Array.from(changedFiles) };
      
      if (input.abortCheck && (await input.abortCheck())) {
        if (input.onLog) await input.onLog("[Hệ thống] Thực thi bị dừng bởi người dùng.");
        return { iterations, changedFiles: Array.from(changedFiles) };
      }
    }
  }

  return {
    iterations,
    changedFiles: Array.from(changedFiles)
  };
}

async function applyFileEdit(workspace: string, edit: FileEdit): Promise<AppliedFileEdit> {
  const validation = validateEditPath(workspace, edit.path);
  if (!validation.ok) {
    return reject(edit, validation.reason);
  }

  const absolutePath = validation.absolutePath;
  try {
    if (edit.action === "create") {
      await assertDoesNotExist(absolutePath);
      await writeFileSafely(absolutePath, edit.content ?? "");
      return apply(edit);
    }

    if (edit.action === "overwrite") {
      await writeFileSafely(absolutePath, edit.content ?? "");
      return apply(edit);
    }

    if (edit.action === "append") {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.appendFile(absolutePath, edit.content ?? "", "utf8");
      return apply(edit);
    }

    if (edit.action === "replace") {
      if (!edit.oldText) return reject(edit, "replace edit cần có oldText");
      const current = await fs.readFile(absolutePath, "utf8");
      if (!current.includes(edit.oldText)) return reject(edit, "Không tìm thấy oldText");
      await writeFileSafely(absolutePath, current.replace(edit.oldText, edit.newText ?? ""));
      return apply(edit);
    }

    return reject(edit, `action không được hỗ trợ: ${(edit as { action?: string }).action}`);
  } catch (error) {
    return reject(edit, error instanceof Error ? error.message : "Lỗi edit chưa xác định");
  }
}

function validateEditPath(workspace: string, relativePath: string): { ok: true; absolutePath: string } | { ok: false; reason: string } {
  if (!relativePath || path.isAbsolute(relativePath)) {
    return { ok: false, reason: "đường dẫn phải là tương đối" };
  }

  const normalized = path.normalize(relativePath);
  const segments = normalized.split(path.sep);
  if (segments.some((segment) => segment === ".." || blockedSegments.has(segment))) {
    return { ok: false, reason: "đường dẫn chứa segment bị chặn" };
  }

  const root = path.resolve(workspace);
  const absolutePath = path.resolve(root, normalized);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    return { ok: false, reason: "đường dẫn thoát khỏi workspace" };
  }

  return { ok: true, absolutePath };
}

async function writeFileSafely(absolutePath: string, content: string) {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

async function assertDoesNotExist(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    throw new Error("file đã tồn tại");
  } catch (error) {
    if (error instanceof Error && error.message === "file đã tồn tại") throw error;
  }
}

function apply(edit: FileEdit): AppliedFileEdit {
  return {
    path: edit.path,
    action: edit.action,
    status: "applied"
  };
}

function reject(edit: FileEdit, reason: string): AppliedFileEdit {
  return {
    path: edit.path,
    action: edit.action,
    status: "rejected",
    reason
  };
}

function buildFixPrompt(commandErrors: string, rejectedEdits: AppliedFileEdit[]) {
  return [
    "Vòng edit code trước đó thất bại.",
    rejectedEdits.length ? `Các edit bị từ chối:\n${rejectedEdits.map((edit) => `- ${edit.path}: ${edit.reason}`).join("\n")}` : "",
    commandErrors ? `Lỗi sandbox:\n${commandErrors}` : "",
    "Chỉ trả về kế hoạch edit file JSON đã sửa."
  ]
    .filter(Boolean)
    .join("\n\n");
}
