import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SandboxCommandResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface SandboxReviewResult {
  mode: string;
  available: boolean;
  commands: SandboxCommandResult[];
}

export async function runSandboxReview(workspace: string): Promise<SandboxReviewResult> {
  const commands = await detectReviewCommands(workspace);
  const mode = process.env.AI_AGENT_SANDBOX || "local";

  if (!commands.length) {
    return {
      mode,
      available: true,
      commands: []
    };
  }

  if (mode === "docker") {
    return runDockerCommands(workspace, commands);
  }

  return runLocalCommands(workspace, commands);
}

async function detectReviewCommands(workspace: string) {
  const packageJsonPath = path.join(workspace, "package.json");
  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    const scripts = parsed.scripts ?? {};
    return [
      scripts.typecheck ? ["npm", ["run", "typecheck"]] : undefined,
      scripts.test ? ["npm", ["test"]] : undefined,
      scripts.build ? ["npm", ["run", "build"]] : undefined
    ].filter(Boolean) as Array<[string, string[]]>;
  } catch {
    return [];
  }
}

async function runLocalCommands(workspace: string, commands: Array<[string, string[]]>): Promise<SandboxReviewResult> {
  const results: SandboxCommandResult[] = [];
  for (const [command, args] of commands) {
    results.push(await runCommand(workspace, command, args));
  }
  return {
    mode: "local",
    available: true,
    commands: results
  };
}

async function runDockerCommands(workspace: string, commands: Array<[string, string[]]>): Promise<SandboxReviewResult> {
  const dockerAvailable = await commandExists("docker", ["--version"]);
  if (!dockerAvailable) {
    return {
      mode: "docker",
      available: false,
      commands: [
        {
          command: "docker --version",
          exitCode: 127,
          stdout: "",
          stderr: "Docker không khả dụng trên máy này."
        }
      ]
    };
  }

  const image = process.env.AI_AGENT_DOCKER_IMAGE || "node:22-alpine";
  const results: SandboxCommandResult[] = [];
  for (const [command, args] of commands) {
    const shellCommand = [command, ...args].map(quoteShellArg).join(" ");
    results.push(
      await runCommand(process.cwd(), "docker", [
        "run",
        "--rm",
        "--network",
        "none",
        "-v",
        `${workspace}:/workspace`,
        "-w",
        "/workspace",
        image,
        "sh",
        "-lc",
        shellCommand
      ])
    );
  }

  return {
    mode: "docker",
    available: true,
    commands: results
  };
}

async function runCommand(cwd: string, command: string, args: string[]): Promise<SandboxCommandResult> {
  const display = [command, ...args].join(" ");
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      timeout: Number(process.env.AI_AGENT_SANDBOX_TIMEOUT_MS || 120000),
      maxBuffer: 1024 * 1024
    });
    return {
      command: display,
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const failure = error as Error & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      signal?: string;
    };
    return {
      command: display,
      exitCode: typeof failure.code === "number" ? failure.code : null,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr || failure.message || failure.signal || "Lệnh thất bại"
    };
  }
}

async function commandExists(command: string, args: string[]) {
  const result = await runCommand(process.cwd(), command, args);
  return result.exitCode === 0;
}

function quoteShellArg(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
