const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");

const TERMINAL_NAME = "AI Agent Terminal";

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const output = vscode.window.createOutputChannel("AI Agent Studio");
  const terminals = new Set();
  const provider = new AgentStudioViewProvider(context, output, terminals);

  context.subscriptions.push(output);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("aiAgentStudio.view", provider));

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAgent.openStudio", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.aiAgentStudio");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAgent.runCodexTask", async () => {
      const idea = await vscode.window.showInputBox({
        title: "AI Agent: yêu cầu cần Codex xử lý",
        prompt: "Nhập chức năng, lỗi hoặc ý tưởng cần làm trong workspace hiện tại.",
        ignoreFocusOut: true
      });
      if (!idea?.trim()) return;
      await provider.runAgent({
        idea,
        mode: "implement"
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAgent.reviewWorkspace", async () => {
      await provider.runAgent({
        idea: "Rà soát toàn bộ workspace hiện tại, tìm lỗi kiến trúc, lỗi UX, lỗi code, thiếu test và đề xuất kế hoạch sửa theo thứ tự ưu tiên.",
        mode: "review"
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAgent.stopTerminals", () => {
      stopAgentTerminals(terminals);
      vscode.window.showInformationMessage("Đã dừng các terminal AI Agent đang mở.");
    })
  );
}

function deactivate() {}

class AgentStudioViewProvider {
  /**
   * @param {vscode.ExtensionContext} context
   * @param {vscode.OutputChannel} output
   * @param {Set<vscode.Terminal>} terminals
   */
  constructor(context, output, terminals) {
    this.context = context;
    this.output = output;
    this.terminals = terminals;
    this.view = undefined;
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => this.handleMessage(message));
  }

  async handleMessage(message) {
    if (!message || typeof message.type !== "string") return;

    if (message.type === "run-agent") {
      await this.runAgent({
        idea: String(message.idea || ""),
        mode: String(message.mode || "implement")
      });
      return;
    }

    if (message.type === "create-prompt") {
      await this.createPromptOnly({
        idea: String(message.idea || ""),
        mode: String(message.mode || "implement")
      });
      return;
    }

    if (message.type === "open-terminal") {
      const workspace = getWorkspaceRoot();
      if (!workspace) return;
      const terminal = this.createTerminal(workspace);
      terminal.show();
      terminal.sendText(`cd ${shellArg(workspace)}`);
      return;
    }

    if (message.type === "run-checks") {
      await this.runChecks();
      return;
    }

    if (message.type === "stop") {
      stopAgentTerminals(this.terminals);
      this.postState("Đã dừng terminal agent.");
    }
  }

  /**
   * @param {{ idea: string; mode: string }} input
   */
  async runAgent(input) {
    const prepared = await this.preparePrompt(input);
    if (!prepared) return;

    const { workspace, promptFile, codexCommand, codexModel, geminiCommand, autoFallback } = prepared;
    this.output.appendLine(`[AI Agent] Prompt: ${promptFile}`);
    this.postState(`Đã tạo prompt. Đang chạy ${codexCommand} trong VS Code Terminal...`);

    const runner = path.join(this.context.extensionPath, "resources", "agent-runner.sh");
    const command = [
      shellArg(runner),
      shellArg(workspace),
      shellArg(promptFile),
      shellArg(codexCommand),
      shellArg(codexModel),
      shellArg(geminiCommand),
      shellArg(String(Boolean(autoFallback)))
    ].join(" ");

    const terminal = this.createTerminal(workspace);
    terminal.show();
    terminal.sendText(command);
  }

  /**
   * @param {{ idea: string; mode: string }} input
   */
  async createPromptOnly(input) {
    const prepared = await this.preparePrompt(input);
    if (!prepared) return;
    const document = await vscode.workspace.openTextDocument(prepared.promptFile);
    await vscode.window.showTextDocument(document, { preview: false });
    this.output.appendLine(`[AI Agent] Prompt: ${prepared.promptFile}`);
    this.postState("Đã tạo prompt và mở file. Bạn có thể chỉnh prompt rồi chạy bằng Terminal.");
  }

  /**
   * @param {{ idea: string; mode: string }} input
   */
  async preparePrompt(input) {
    const workspace = getWorkspaceRoot();
    if (!workspace) {
      vscode.window.showErrorMessage("Hãy mở một folder workspace trong VS Code trước khi chạy AI Agent.");
      return undefined;
    }

    const idea = input.idea.trim();
    if (idea.length < 8) {
      vscode.window.showWarningMessage("Yêu cầu quá ngắn. Hãy mô tả rõ việc cần làm.");
      return undefined;
    }

    const config = vscode.workspace.getConfiguration("aiAgent");
    const codexCommand = config.get("codexCommand", "codex");
    const codexModel = config.get("codexModel", "gpt-5.5");
    const geminiCommand = config.get("geminiCommand", "gemini");
    const autoFallback = config.get("autoFallbackGemini", true);
    const prompt = buildAgentPrompt({
      workspace,
      idea,
      mode: input.mode,
      codexModel
    });
    const promptFile = await writePromptFile(workspace, prompt, input.mode);

    return { workspace, promptFile, codexCommand, codexModel, geminiCommand, autoFallback };
  }

  async runChecks() {
    const workspace = getWorkspaceRoot();
    if (!workspace) {
      vscode.window.showErrorMessage("Hãy mở workspace trước khi chạy kiểm tra.");
      return;
    }

    const packageJsonPath = path.join(workspace, "package.json");
    const terminal = this.createTerminal(workspace);
    terminal.show();
    terminal.sendText(`cd ${shellArg(workspace)}`);

    if (!fs.existsSync(packageJsonPath)) {
      terminal.sendText("pwd && ls -la");
      this.postState("Workspace không có package.json, đã mở terminal để kiểm tra thủ công.");
      return;
    }

    const scripts = readPackageScripts(packageJsonPath);
    const commands = [];
    if (scripts.typecheck) commands.push("npm run typecheck");
    if (scripts.test) commands.push("npm test");
    if (scripts.build) commands.push("npm run build");
    if (commands.length === 0) commands.push("npm install --dry-run");
    terminal.sendText(commands.join(" && "));
    this.postState(`Đã chạy kiểm tra: ${commands.join(" → ")}`);
  }

  /**
   * @param {string} workspace
   */
  createTerminal(workspace) {
    const terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      cwd: workspace
    });
    this.terminals.add(terminal);
    return terminal;
  }

  /**
   * @param {string} text
   */
  postState(text) {
    this.view?.webview.postMessage({ type: "state", text });
  }

  renderHtml(webview) {
    const nonce = String(Date.now());
    const workspace = getWorkspaceRoot() || "Chưa mở workspace";
    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Agent Studio</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-sideBar-background);
      --fg: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --line: var(--vscode-panel-border);
      --accent: var(--vscode-button-background);
      --accent-fg: var(--vscode-button-foreground);
      --input: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .stack { display: grid; gap: 12px; }
    .hero {
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    h1 {
      margin: 0 0 6px;
      font-size: 18px;
      line-height: 1.25;
    }
    p { margin: 0; color: var(--muted); line-height: 1.45; }
    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-weight: 700;
    }
    textarea,
    select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 9px;
      background: var(--input);
      color: var(--input-fg);
      font: inherit;
    }
    textarea { min-height: 150px; resize: vertical; line-height: 1.5; }
    .workspace {
      padding: 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--muted);
      word-break: break-word;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }
    .actions { display: grid; gap: 8px; grid-template-columns: 1fr; }
    button {
      min-height: 34px;
      border: 0;
      border-radius: 6px;
      padding: 0 10px;
      background: var(--accent);
      color: var(--accent-fg);
      cursor: pointer;
      font-weight: 800;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.danger {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--fg);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }
    .state {
      min-height: 34px;
      padding: 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--muted);
      line-height: 1.45;
    }
    .hint {
      display: grid;
      gap: 6px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    code { font-family: var(--vscode-editor-font-family); }
  </style>
</head>
<body>
  <main class="stack">
    <section class="hero">
      <h1>AI Agent Studio</h1>
      <p>Chạy Codex/Gemini trực tiếp trên workspace và Terminal của VS Code.</p>
    </section>

    <div class="workspace">${escapeHtml(workspace)}</div>

    <label>
      Chế độ
      <select id="mode">
        <option value="implement">Tự code / sửa chức năng</option>
        <option value="plan">Phân tích và lập kế hoạch</option>
        <option value="review">Rà soát toàn bộ dự án</option>
        <option value="fix">Sửa lỗi theo mô tả</option>
      </select>
    </label>

    <label>
      Yêu cầu cho AI
      <textarea id="idea" placeholder="Ví dụ: Rà soát dự án, sửa UI, thêm chức năng upload thư mục, chạy test rồi tự fix lỗi..."></textarea>
    </label>

    <section class="actions">
      <button id="run">Chạy Codex trong Terminal</button>
      <button id="prompt" class="secondary">Tạo prompt và mở file</button>
      <button id="checks" class="secondary">Chạy kiểm tra dự án</button>
      <button id="terminal" class="secondary">Mở Terminal tại workspace</button>
      <button id="stop" class="danger">Dừng terminal agent</button>
    </section>

    <div id="state" class="state">Sẵn sàng.</div>

    <section class="hint">
      <p><strong>Luồng chính:</strong> prompt được lưu ở <code>.ai-agent/prompts</code>, terminal ưu tiên Codex CLI. Nếu Codex lỗi và bật fallback, runner chuyển sang Gemini CLI.</p>
      <p><strong>Yêu cầu:</strong> đăng nhập <code>codex</code> trong terminal Mac, hoặc cấu hình Gemini CLI nếu muốn fallback.</p>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const idea = document.getElementById("idea");
    const mode = document.getElementById("mode");
    const state = document.getElementById("state");

    document.getElementById("run").addEventListener("click", () => {
      vscode.postMessage({ type: "run-agent", idea: idea.value, mode: mode.value });
    });

    document.getElementById("prompt").addEventListener("click", () => {
      vscode.postMessage({ type: "create-prompt", idea: idea.value, mode: mode.value });
    });

    document.getElementById("checks").addEventListener("click", () => {
      vscode.postMessage({ type: "run-checks" });
    });

    document.getElementById("terminal").addEventListener("click", () => {
      vscode.postMessage({ type: "open-terminal" });
    });

    document.getElementById("stop").addEventListener("click", () => {
      vscode.postMessage({ type: "stop" });
    });

    window.addEventListener("message", (event) => {
      if (event.data?.type === "state") state.textContent = event.data.text;
    });
  </script>
</body>
</html>`;
  }
}

function getWorkspaceRoot() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * @param {{ workspace: string; idea: string; mode: string; codexModel: string }} input
 */
function buildAgentPrompt(input) {
  const modeLabels = {
    implement: "Tự phân tích, tự sửa code, chạy lệnh kiểm tra và fix lỗi trong workspace.",
    plan: "Rà soát ý tưởng, codebase và lập kế hoạch tác vụ cụ thể trước khi sửa.",
    review: "Rà soát toàn bộ codebase theo kiểu code review, ưu tiên bug/risk/test gap.",
    fix: "Tập trung sửa lỗi theo mô tả, giữ phạm vi nhỏ và kiểm chứng bằng terminal."
  };
  const workspaceSummary = summarizeWorkspace(input.workspace);
  return [
    "# AI Agent Studio - VS Code Terminal Task",
    "",
    `Workspace: ${input.workspace}`,
    `Chế độ: ${modeLabels[input.mode] || modeLabels.implement}`,
    `Model ưu tiên: ${input.codexModel}`,
    "",
    "## Yêu cầu người dùng",
    input.idea,
    "",
    "## Ngữ cảnh nhanh của workspace",
    workspaceSummary,
    "",
    "## Quy tắc thao tác",
    "- Làm trực tiếp trong workspace VS Code hiện tại.",
    "- Ưu tiên Codex. Nếu Codex không còn token, hết quota hoặc lỗi kết nối, runner sẽ chuyển sang Gemini CLI.",
    "- Trước khi sửa lớn, đọc file liên quan và nêu ngắn gọn hướng làm trong terminal.",
    "- Không sửa ngoài workspace. Không đụng `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage` trừ khi người dùng yêu cầu rõ.",
    "- Chia việc thành bước nhỏ. Với yêu cầu lớn, tách prompt/tác vụ để model yếu không quá tải.",
    "- Sau khi sửa, chạy kiểm tra phù hợp nếu repo có script: typecheck, test, build.",
    "- Nếu không thể chạy kiểm tra, nói rõ lý do và file đã sửa.",
    "- Trả lời cuối bằng tiếng Việt, nêu file đã đổi và kết quả kiểm tra.",
    "",
    "## Mục tiêu đầu ra",
    "- Code hoặc thay đổi cụ thể đã được áp dụng.",
    "- Không chỉ đưa kế hoạch nếu chế độ là tự code/sửa lỗi.",
    "- Nếu chỉ review, liệt kê finding theo mức độ nghiêm trọng kèm file/line."
  ].join("\n");
}

/**
 * @param {string} workspace
 * @param {string} prompt
 * @param {string} mode
 */
async function writePromptFile(workspace, prompt, mode) {
  const promptDir = path.join(workspace, ".ai-agent", "prompts");
  await fs.promises.mkdir(promptDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const promptFile = path.join(promptDir, `${stamp}-${safeSlug(mode)}.md`);
  await fs.promises.writeFile(promptFile, prompt, "utf8");
  return promptFile;
}

function summarizeWorkspace(workspace) {
  const lines = [];
  const packageJsonPath = path.join(workspace, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      lines.push(`- package: ${pkg.name || "không có tên"}`);
      lines.push(`- scripts: ${Object.keys(pkg.scripts || {}).join(", ") || "không có"}`);
      lines.push(`- dependencies chính: ${Object.keys(pkg.dependencies || {}).slice(0, 16).join(", ") || "không có"}`);
    } catch (error) {
      lines.push(`- package.json lỗi đọc: ${error.message}`);
    }
  }

  const candidates = [
    "README.md",
    "tsconfig.json",
    "next.config.js",
    "next.config.mjs",
    "vite.config.ts",
    "src",
    "app",
    "components",
    "lib",
    "packages"
  ];
  const existing = candidates.filter((item) => fs.existsSync(path.join(workspace, item)));
  lines.push(`- mục phát hiện: ${existing.join(", ") || "chưa thấy file/mục quen thuộc"}`);
  return lines.join("\n");
}

function readPackageScripts(packageJsonPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return pkg.scripts || {};
  } catch {
    return {};
  }
}

function stopAgentTerminals(terminals) {
  for (const terminal of terminals) {
    terminal.dispose();
  }
  terminals.clear();
}

function shellArg(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function safeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "task";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  activate,
  deactivate
};
