import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AppliedFileEdit,
  CodeEditIteration,
  CodebaseContext,
  ExecutionPrompt
} from "@/packages/schemas/project-blueprint.schema";
import { runSandboxReview } from "@/packages/orchestrator/sandbox-runner";

const execFileAsync = promisify(execFile);
const ignoredSegments = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".ai-agent"]);

interface FileSnapshot {
  size: number;
  mtimeMs: number;
}

export async function runCodexCliEditingLoop(input: {
  workspace: string;
  prompts: ExecutionPrompt[];
  codebaseContext?: CodebaseContext;
  maxIterations?: number;
  onLog?: (msg: string) => Promise<void>;
  abortCheck?: () => Promise<boolean>;
}): Promise<{ iterations: CodeEditIteration[]; changedFiles: string[] }> {
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
      const before = await snapshotWorkspace(input.workspace);
      const codexPrompt = buildCodexPrompt(prompt, input.codebaseContext, previousError);
      if (input.onLog) {
        await input.onLog(`[Iter ${iterationNumber}] Gửi Prompt (Codex):\n${prompt.title}\n${previousError ? `\nLỗi trước đó:\n${previousError}` : ""}`);
      }

      const codexResult = await runCodexExec({
        workspace: input.workspace,
        prompt: codexPrompt
      });

      if (input.onLog) {
        await input.onLog(`[Iter ${iterationNumber}] Kết quả từ Codex:\n[ExitCode: ${codexResult.exitCode}]\n${codexResult.stdout}\n${codexResult.stderr ? `Lỗi: ${codexResult.stderr}` : ""}`);
      }
      const after = await snapshotWorkspace(input.workspace);
      const changed = diffSnapshots(before, after);
      changed.forEach((file) => changedFiles.add(file));

      const sandboxResult = await runSandboxReview(input.workspace);
      const failedCommands = sandboxResult.commands.filter((command) => command.exitCode !== 0);
      const rejectedEdits = buildRejectedEdits(codexResult.exitCode, codexResult.stderr, codexResult.stdout);
      const fixPrompt =
        codexResult.exitCode !== 0 || failedCommands.length
          ? buildFixPrompt({
              codexError: codexResult.stderr || codexResult.stdout,
              commandErrors: failedCommands.map((command) => `${command.command}\n${command.stderr || command.stdout}`).join("\n\n")
            })
          : undefined;

      iterations.push({
        iteration: iterationNumber,
        promptTitle: prompt.title,
        provider: "codex-cli",
        mode: codexResult.mode,
        summary: codexResult.lastMessage || summarizeOutput(codexResult.stdout, codexResult.stderr),
        appliedEdits: changed.map((file) => ({
          path: file,
          action: "overwrite",
          status: "applied"
        })),
        rejectedEdits,
        executorExitCode: codexResult.exitCode,
        stdout: truncate(codexResult.stdout),
        stderr: truncate(codexResult.stderr),
        sandboxResult,
        fixPrompt
      });

      if (!fixPrompt) break;
      previousError = fixPrompt;
      if (attempt === maxFixIterations) {
        return {
          iterations,
          changedFiles: Array.from(changedFiles)
        };
      }
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

async function runCodexExec(input: { workspace: string; prompt: string }) {
  const codexCommand = process.env.AI_AGENT_CODEX_COMMAND || "codex";
  const outputDir = path.join(input.workspace, ".ai-agent", "codex");
  await fs.mkdir(outputDir, { recursive: true });
  const lastMessagePath = path.join(outputDir, `last-message-${Date.now()}.txt`);

  const args = ["exec", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check", "--cd", input.workspace];
  if (process.env.AI_AGENT_CODEX_MODEL) {
    args.push("--model", process.env.AI_AGENT_CODEX_MODEL);
  }
  if (process.env.AI_AGENT_CODEX_PROFILE) {
    args.push("--profile", process.env.AI_AGENT_CODEX_PROFILE);
  }
  if (process.env.AI_AGENT_CODEX_EPHEMERAL === "true") {
    args.push("--ephemeral");
  }
  args.push("--output-last-message", lastMessagePath, input.prompt);

  try {
    const result = await execFileAsync(codexCommand, args, {
      cwd: input.workspace,
      timeout: Number(process.env.AI_AGENT_CODEX_TIMEOUT_MS || 600000),
      maxBuffer: 1024 * 1024 * 8
    });
    return {
      mode: "danger-full-access",
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      lastMessage: await readOptional(lastMessagePath)
    };
  } catch (error) {
    const failure = error as Error & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      signal?: string;
    };
    return {
      mode: "danger-full-access",
      exitCode: typeof failure.code === "number" ? failure.code : null,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr || failure.message || failure.signal || "Codex CLI thất bại",
      lastMessage: await readOptional(lastMessagePath)
    };
  }
}

function buildCodexPrompt(prompt: ExecutionPrompt, codebaseContext?: CodebaseContext, previousError?: string) {
  return [
    "Bạn đang chạy với vai trò Code Editing Executor cho hệ thống AI Agent.",
    "Khi cần, hãy sửa file trực tiếp trong workspace hiện tại.",
    "Giữ thay đổi tối thiểu và bám sát prompt thực thi đã được duyệt.",
    "Không sửa .git, node_modules, .next, dist, build, coverage hoặc .ai-agent.",
    "Sau khi sửa, hãy giải thích ngắn gọn các file đã thay đổi.",
    "",
    codebaseContext
      ? [
          "Ngữ cảnh codebase hiện có:",
          `- Framework: ${codebaseContext.frameworkSignals.join(", ") || "chưa rõ"}`,
          `- Ngôn ngữ: ${codebaseContext.languages.join(", ") || "chưa rõ"}`,
          `- Trình quản lý gói: ${codebaseContext.packageManager || "chưa rõ"}`,
          `- File quan trọng: ${codebaseContext.keyFiles.slice(0, 60).join(", ") || "không có"}`
        ].join("\n")
      : "",
    previousError ? `Lần kiểm chứng trước thất bại. Chỉ sửa các vấn đề này:\n${previousError}` : "",
    "",
    "Prompt thực thi đã duyệt:",
    prompt.prompt
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function snapshotWorkspace(workspace: string): Promise<Map<string, FileSnapshot>> {
  const snapshot = new Map<string, FileSnapshot>();
  await walk(workspace, "", snapshot);
  return snapshot;
}

async function walk(root: string, relativeDir: string, snapshot: Map<string, FileSnapshot>) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredSegments.has(entry.name)) continue;
      await walk(root, relativePath, snapshot);
      continue;
    }
    if (!entry.isFile()) continue;
    if (isLikelyBinary(entry.name)) continue;
    const stat = await fs.stat(path.join(root, relativePath));
    snapshot.set(relativePath.split(path.sep).join("/"), {
      size: stat.size,
      mtimeMs: stat.mtimeMs
    });
  }
}

function diffSnapshots(before: Map<string, FileSnapshot>, after: Map<string, FileSnapshot>) {
  const changed: string[] = [];
  for (const [file, next] of after) {
    const previous = before.get(file);
    if (!previous || previous.size !== next.size || previous.mtimeMs !== next.mtimeMs) {
      changed.push(file);
    }
  }
  return changed;
}

function buildRejectedEdits(exitCode: number | null, stderr: string, stdout: string): AppliedFileEdit[] {
  if (exitCode === 0) return [];
  return [
    {
      path: "codex-cli",
      action: "overwrite",
      status: "rejected",
      reason: truncate(stderr || stdout || "Codex CLI kết thúc nhưng không có trạng thái thành công.")
    }
  ];
}

function buildFixPrompt(input: { codexError?: string; commandErrors?: string }) {
  return [
    "Codex thực thi hoặc kiểm chứng thất bại.",
    input.codexError ? `Lỗi Codex CLI:\n${input.codexError}` : "",
    input.commandErrors ? `Lỗi sandbox:\n${input.commandErrors}` : "",
    "Chạy một lần sửa tập trung. Giữ nguyên các thay đổi đã thành công."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function summarizeOutput(stdout: string, stderr: string) {
  return truncate(stdout || stderr || "Codex CLI hoàn tất nhưng không có output.");
}

async function readOptional(filePath: string) {
  try {
    return (await fs.readFile(filePath, "utf8")).trim();
  } catch {
    return undefined;
  }
}

function truncate(value: string, maxLength = 6000) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n...[đã cắt bớt]`;
}

function isLikelyBinary(fileName: string) {
  return /\.(png|jpe?g|gif|webp|ico|pdf|zip|tar|gz|mp4|mov|mp3|woff2?|ttf|eot)$/i.test(fileName);
}
