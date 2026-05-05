import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { apiOk } from "@/lib/api";

const execFileAsync = promisify(execFile);

export async function GET() {
  const command = process.env.AI_AGENT_CODEX_COMMAND || "codex";
  const version = await run(command, ["--version"]);
  const login = await run(command, ["login", "status"]);

  return apiOk({
    command,
    available: version.exitCode === 0,
    version: version.stdout.trim() || version.stderr.trim(),
    loggedIn: login.exitCode === 0 && /Logged in/i.test(`${login.stdout}\n${login.stderr}`),
    loginStatus: formatLoginStatus((login.stdout || login.stderr).trim()),
    executorEnabled: process.env.AI_AGENT_EXECUTOR === "codex" || (version.exitCode === 0 && /Logged in/i.test(`${login.stdout}\n${login.stderr}`))
  });
}

function formatLoginStatus(value: string) {
  if (!value) return "";
  return value
    .replace(/Logged in using ChatGPT/i, "Đã đăng nhập bằng ChatGPT")
    .replace(/Not logged in/i, "Chưa đăng nhập")
    .replace(/Login required/i, "Cần đăng nhập");
}

async function run(command: string, args: string[]) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: 15000,
      maxBuffer: 1024 * 1024
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const failure = error as Error & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr || failure.message
    };
  }
}
