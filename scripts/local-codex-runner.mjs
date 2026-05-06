#!/usr/bin/env node
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PROMPTFLOW_RUNNER_PORT || 8787);
const RUN_ROOT = join(tmpdir(), "promptflow-agent-runs");
const CODEX_FULL_ACCESS_ARGS = "--dangerously-bypass-approvals-and-sandbox";
const executions = new Map();

mkdirSync(RUN_ROOT, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: Boolean(findCodex()), codexPath: findCodex() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/run") {
      sendJson(res, 200, runCodexTask(await readJson(req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/resolve-workspace") {
      const body = await readJson(req);
      const requestedWorkspace = expandHome(String(body.workspaceDir || "").trim());
      const folderName = String(body.folderName || "").trim();
      const workspaceDir = resolveWorkspaceDir(requestedWorkspace, folderName);
      sendJson(res, 200, {
        ok: Boolean(workspaceDir && isUsableDirectory(workspaceDir)),
        workspaceDir: workspaceDir && isUsableDirectory(workspaceDir) ? workspaceDir : "",
        requestedWorkspace,
        folderName
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/status/")) {
      const execution = refreshExecution(decodeURIComponent(url.pathname.replace("/status/", "")));
      if (!execution) {
        sendJson(res, 404, { message: "Không tìm thấy execution." });
        return;
      }
      sendJson(res, 200, execution);
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/stop/")) {
      const execution = stopExecution(decodeURIComponent(url.pathname.replace("/stop/", "")));
      if (!execution) {
        sendJson(res, 404, { message: "Không tìm thấy execution." });
        return;
      }
      sendJson(res, 200, execution);
      return;
    }

    sendJson(res, 404, { message: "Endpoint không tồn tại." });
  } catch (error) {
    sendJson(res, 500, { message: error instanceof Error ? error.message : "Local runner lỗi." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PromptFlow local Codex runner listening on http://${HOST}:${PORT}`);
  console.log(`Codex CLI: ${findCodex() || "not found"}`);
});

function runCodexTask(body) {
  const prompt = String(body.prompt || "").trim();
  const requestedWorkspace = expandHome(String(body.workspaceDir || "").trim());
  const folderName = String(body.folderName || "").trim();
  const workspaceDir = resolveWorkspaceDir(requestedWorkspace, folderName);
  const taskInternalId = String(body.taskInternalId || "");
  const taskId = String(body.taskId || "");
  const title = String(body.title || "PromptFlow task");

  if (!prompt) throw new Error("Prompt rỗng.");
  if (!workspaceDir || !existsSync(workspaceDir) || !statSync(workspaceDir).isDirectory()) {
    throw new Error(`Workspace không tồn tại hoặc không phải folder: ${requestedWorkspace || folderName}`);
  }

  const codexPath = findCodex();
  if (!codexPath) throw new Error("Không tìm thấy Codex CLI trong PATH.");

  const executionId = randomUUID();
  const runDir = join(RUN_ROOT, executionId);
  mkdirSync(runDir, { recursive: true });

  const promptFile = join(runDir, "prompt.txt");
  const scriptFile = join(runDir, "run.sh");
  const pidFile = join(runDir, "runner.pid");
  const statusFile = join(runDir, "status.txt");

  writeFileSync(promptFile, prompt, "utf8");
  writeFileSync(statusFile, "opening_terminal", "utf8");
  writeFileSync(scriptFile, buildShellScript({ codexPath, workspaceDir, promptFile, pidFile, statusFile }), {
    mode: 0o700
  });

  const terminalCommand = `bash ${shellQuote(scriptFile)}`;
  const osa = spawnSync("osascript", [
    "-e",
    ['tell application "Terminal"', "activate", `do script ${appleScriptString(terminalCommand)}`, "end tell"].join("\n")
  ]);

  if (osa.status !== 0) {
    throw new Error(`Không mở được Terminal: ${osa.stderr?.toString() || osa.stdout?.toString() || "unknown error"}`);
  }

  const execution = {
    executionId,
    taskInternalId,
    taskId,
    title,
    status: "running",
    currentStep: "Terminal đã mở, Codex CLI đang chạy prompt trong workspace.",
    workspaceDir,
    terminalCommand: `cd ${workspaceDir} && codex ${CODEX_FULL_ACCESS_ARGS} --cd ${workspaceDir} "$(cat prompt.txt)"`,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pidFile,
    statusFile
  };

  executions.set(executionId, execution);
  return publicExecution(execution);
}

function buildShellScript({ codexPath, workspaceDir, promptFile, pidFile, statusFile }) {
  return `#!/usr/bin/env bash
set +e
echo $$ > ${shellQuote(pidFile)}
trap 'kill $(jobs -p) 2>/dev/null' TERM INT
echo running > ${shellQuote(statusFile)}
cd ${shellQuote(workspaceDir)} || { echo "failed:cannot_cd" > ${shellQuote(statusFile)}; exit 1; }
echo "PromptFlow Agent"
echo "Workspace: ${workspaceDir}"
echo "Mode: Codex CLI full access"
echo "Loading prompt from: ${promptFile}"
echo
${shellQuote(codexPath)} ${CODEX_FULL_ACCESS_ARGS} --cd ${shellQuote(workspaceDir)} "$(cat ${shellQuote(promptFile)})"
code=$?
if [ "$code" -eq 0 ]; then
  echo done > ${shellQuote(statusFile)}
else
  echo "failed:$code" > ${shellQuote(statusFile)}
fi
exit "$code"
`;
}

function refreshExecution(executionId) {
  const execution = executions.get(executionId);
  if (!execution) return undefined;

  const statusText = safeRead(execution.statusFile).trim();
  if (statusText === "done") {
    execution.status = "done";
    execution.currentStep = "Codex CLI đã chạy xong task.";
  } else if (statusText.startsWith("failed")) {
    execution.status = "failed";
    execution.currentStep = "Codex CLI kết thúc với lỗi.";
    execution.error = statusText;
  } else if (statusText === "stopped") {
    execution.status = "stopped";
    execution.currentStep = "Task đã được yêu cầu dừng.";
  } else if (statusText === "running") {
    execution.status = "running";
    execution.currentStep = "Codex CLI đang chạy trong Terminal.";
  }

  execution.updatedAt = new Date().toISOString();
  return publicExecution(execution);
}

function stopExecution(executionId) {
  const execution = executions.get(executionId);
  if (!execution) return undefined;

  const pid = safeRead(execution.pidFile).trim();
  if (pid && /^\d+$/.test(pid)) {
    spawn("pkill", ["-TERM", "-P", pid], { stdio: "ignore" }).unref();
    spawn("kill", ["-TERM", pid], { stdio: "ignore" }).unref();
  }

  writeFileSync(execution.statusFile, "stopped", "utf8");
  execution.status = "stopped";
  execution.currentStep = "Đã gửi tín hiệu dừng tới shell đang chạy Codex.";
  execution.updatedAt = new Date().toISOString();
  return publicExecution(execution);
}

function publicExecution(execution) {
  const { pidFile, statusFile, ...safe } = execution;
  return safe;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("Payload quá lớn."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON không hợp lệ."));
      }
    });
    req.on("error", reject);
  });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function findCodex() {
  const result = spawnSync("sh", ["-lc", "command -v codex"], { encoding: "utf8" });
  return result.stdout?.trim() || "";
}

function expandHome(value) {
  if (value.startsWith("~/")) return join(process.env.HOME || "", value.slice(2));
  return value;
}

function resolveWorkspaceDir(requestedWorkspace, folderName) {
  if (requestedWorkspace && isUsableDirectory(requestedWorkspace)) {
    return realpathSync(requestedWorkspace);
  }

  const candidateName = sanitizeFolderName(folderName || requestedWorkspace);
  if (!candidateName) return requestedWorkspace;

  const roots = [
    process.env.PROMPTFLOW_PROJECT_ROOT,
    "/Applications/du-an",
    dirname(process.cwd()),
    process.cwd(),
    process.env.HOME,
    process.env.HOME ? join(process.env.HOME, "Desktop") : "",
    process.env.HOME ? join(process.env.HOME, "Downloads") : "",
    process.env.HOME ? join(process.env.HOME, "Documents") : ""
  ].filter(Boolean);

  for (const root of roots) {
    const candidate = resolve(expandHome(root), candidateName);
    if (isUsableDirectory(candidate)) {
      return realpathSync(candidate);
    }
  }

  return requestedWorkspace;
}

function isUsableDirectory(path) {
  try {
    return Boolean(path) && existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function sanitizeFolderName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("/") || raw.includes("\\")) return basename(raw);
  const selectedMatch = raw.match(/^Selected folder:\s*([^(]+)\s*\(/i);
  if (selectedMatch?.[1]) return selectedMatch[1].trim();
  return raw;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function appleScriptString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function safeRead(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
