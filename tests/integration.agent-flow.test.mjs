import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const port = Number(process.env.TEST_PORT || 3210);
const baseUrl = `http://127.0.0.1:${port}`;

test("analyze -> approve latest -> execute -> review, then block stale approval after rerun", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ai-agent-integration-"));
  const server = spawn(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port)
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AI_AGENT_DB_PATH: path.join(tempRoot, "db.json"),
        AI_AGENT_WORKSPACE_ROOT: path.join(tempRoot, "workspaces"),
        AI_AGENT_LLM_PROVIDER: "mock",
        AI_AGENT_SANDBOX: "local",
        AI_AGENT_MAX_FIX_ITERATIONS: "1",
        AI_AGENT_STATIC_FILE_EDITS: JSON.stringify({
          summary: "Static test edit",
          edits: [
            {
              path: "AI_AGENT_EDITED.md",
              action: "overwrite",
              content: "Edited by static provider\\n"
            }
          ]
        })
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  t.after(async () => {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(serverOutput);

  const uploadForm = new FormData();
  uploadForm.append(
    "files",
    new Blob([JSON.stringify({ scripts: { test: "node -e \"process.exit(0)\"" } }, null, 2)]),
    "sample-app/package.json"
  );
  uploadForm.append("files", new Blob(["# Sample app\n"]), "sample-app/README.md");
  const uploaded = await multipartPost("/api/uploads/codebase", uploadForm);
  assert.equal(uploaded.fileCount, 2);
  assert.equal(path.dirname(uploaded.sourcePath), path.join(tempRoot, "workspaces", "uploads"));
  assert.match(await readFile(path.join(uploaded.sourcePath, "package.json"), "utf8"), /scripts/);

  const created = await post("/api/projects", {
    rawIdea: "Tao bot Telegram nhan lenh /report, lay du lieu Google Sheets va gui bao cao hang ngay cho team sale."
  });
  const projectId = created.project.id;

  const analyzed = await post(`/api/projects/${projectId}/analyze`, { autoAssume: true });
  assert.equal(analyzed.blueprint.project.projectType, "bot");

  const latest = latestArtifacts(analyzed.blueprint.artifacts);
  for (const type of ["requirements", "feature_discovery", "architecture_plan", "task_plan", "execution_prompt"]) {
    assert.ok(latest[type], `missing ${type}`);
    await post(`/api/projects/${projectId}/artifacts/${latest[type].id}/approve`);
  }

  const executed = await post(`/api/projects/${projectId}/execute`);
  assert.equal(executed.result.completedTasks, analyzed.blueprint.tasks.length);
  assert.equal(executed.result.approvedArtifactSnapshot.length, 5);

  const reviewed = await post(`/api/projects/${projectId}/review`);
  assert.equal(reviewed.report.passed, true);
  assert.equal(reviewed.report.findings.length, 0);

  await post(`/api/projects/${projectId}/analyze`, { autoAssume: true });
  const staleExecute = await request(`/api/projects/${projectId}/execute`, {
    method: "POST",
    body: {}
  });
  assert.equal(staleExecute.ok, false);
  assert.equal(staleExecute.status, 400);
  assert.match(staleExecute.data.error, /phiên bản tài liệu mới nhất/);

  const existingRepo = path.join(tempRoot, "existing-next-app");
  await mkdir(path.join(existingRepo, "app"), { recursive: true });
  await writeFile(
    path.join(existingRepo, "package.json"),
    JSON.stringify(
      {
        scripts: {
          typecheck: "node -e \"process.exit(0)\"",
          test: "node -e \"process.exit(0)\"",
          build: "node -e \"process.exit(0)\""
        },
        dependencies: {
          next: "15.0.0",
          react: "19.0.0"
        },
        devDependencies: {
          typescript: "5.7.2"
        }
      },
      null,
      2
    )
  );
  await writeFile(path.join(existingRepo, "app", "page.tsx"), "export default function Page() { return <main>Hello</main>; }\n");

  const existing = await post("/api/projects", {
    rawIdea: "Sua landing page hien co de them section pricing va CTA ro hon.",
    mode: "existing_project",
    sourcePath: existingRepo
  });
  const existingProjectId = existing.project.id;
  const attached = await post(`/api/projects/${existingProjectId}/codebase`, { sourcePath: existingRepo });
  assert.equal(attached.blueprint.codebaseContext.rootName, "existing-next-app");
  assert.ok(attached.blueprint.codebaseContext.frameworkSignals.includes("Next.js"));

  const existingAnalyzed = await post(`/api/projects/${existingProjectId}/analyze`, { autoAssume: true });
  const existingLatest = latestArtifacts(existingAnalyzed.blueprint.artifacts);
  for (const type of [
    "codebase_context",
    "requirements",
    "feature_discovery",
    "architecture_plan",
    "task_plan",
    "execution_prompt"
  ]) {
    assert.ok(existingLatest[type], `missing existing ${type}`);
    await post(`/api/projects/${existingProjectId}/artifacts/${existingLatest[type].id}/approve`);
  }

  const existingExecuted = await post(`/api/projects/${existingProjectId}/execute`);
  assert.equal(existingExecuted.result.workspace, existingRepo);
  assert.equal(existingExecuted.result.approvedArtifactSnapshot.length, 6);
  assert.ok(existingExecuted.result.changedFiles.includes("AI_AGENT_EDITED.md"));
  assert.match(await readFile(path.join(existingRepo, "AI_AGENT_EDITED.md"), "utf8"), /Edited by static provider/);

  const existingReviewed = await post(`/api/projects/${existingProjectId}/review`);
  assert.equal(existingReviewed.report.passed, true);
  assert.equal(existingReviewed.report.sandboxResult.commands.length, 3);
});

async function waitForServer(output) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 45000) {
    try {
      const response = await fetch(`${baseUrl}/api/projects`);
      if (response.ok) return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Server did not start. Output:\n${output}`);
}

async function post(pathname, body = {}) {
  const response = await request(pathname, {
    method: "POST",
    body
  });
  if (!response.ok) {
    throw new Error(`${pathname} failed ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: init.method || "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { text };
  }
  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function multipartPost(pathname, formData) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    body: formData
  });
  const text = await response.text();
  const data = JSON.parse(text);
  if (!response.ok) {
    throw new Error(`${pathname} failed ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function latestArtifacts(artifacts) {
  return artifacts.reduce((acc, artifact) => {
    const current = acc[artifact.artifactType];
    if (!current || artifact.version > current.version) {
      acc[artifact.artifactType] = artifact;
    }
    return acc;
  }, {});
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
