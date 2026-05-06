const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");

const PLAN_DIR = path.join(".ai-agent", "task-plans");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const output = vscode.window.createOutputChannel("AI Agent Task Architect");
  const provider = new TaskArchitectViewProvider(context, output);

  context.subscriptions.push(output);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("aiAgentStudio.view", provider));

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAgent.openStudio", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.aiAgentStudio");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAgent.generateTaskPlan", async () => {
      const idea = await vscode.window.showInputBox({
        title: "AI Agent: prompt cần phân rã",
        prompt: "Nhập ý tưởng hoặc yêu cầu. Agent chỉ phân tích và chia nhiệm vụ, không tự code.",
        ignoreFocusOut: true
      });
      if (!idea?.trim()) return;
      await provider.generateTaskPlan({ idea, scale: "auto" });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAgent.openLastPlan", async () => {
      await provider.openLastPlan();
    })
  );
}

function deactivate() {}

class TaskArchitectViewProvider {
  /**
   * @param {vscode.ExtensionContext} context
   * @param {vscode.OutputChannel} output
   */
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.view = undefined;
    this.lastPlanFile = undefined;
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.renderHtml();
    webviewView.webview.onDidReceiveMessage((message) => this.handleMessage(message));
  }

  async handleMessage(message) {
    if (!message || typeof message.type !== "string") return;

    if (message.type === "generate-plan") {
      await this.generateTaskPlan({
        idea: String(message.idea || ""),
        scale: String(message.scale || "auto")
      });
      return;
    }

    if (message.type === "open-last-plan") {
      await this.openLastPlan();
    }
  }

  /**
   * @param {{ idea: string; scale: string }} input
   */
  async generateTaskPlan(input) {
    const workspace = getWorkspaceRoot();
    if (!workspace) {
      vscode.window.showErrorMessage("Hãy mở một folder workspace trong VS Code trước khi tạo kế hoạch.");
      return;
    }

    const idea = input.idea.trim();
    if (idea.length < 8) {
      vscode.window.showWarningMessage("Prompt quá ngắn. Hãy mô tả rõ phần cần phân rã.");
      return;
    }

    this.postState("Đang phân tích prompt và chia nhiệm vụ xếp tầng...");
    const config = vscode.workspace.getConfiguration("aiAgent");
    const scale = resolveScale(input.scale, idea);
    const workspaceSummary = summarizeWorkspace(workspace);
    const providerResult = await createPlanWithProvider({
      idea,
      scale,
      workspaceSummary,
      config,
      output: this.output
    });

    const plan = normalizePlan(providerResult.plan, {
      idea,
      scale,
      workspaceSummary,
      provider: providerResult.provider
    });
    const files = await writePlanFiles(workspace, plan);
    this.lastPlanFile = files.markdownPath;
    this.output.appendLine(`[Task Architect] Markdown: ${files.markdownPath}`);
    this.output.appendLine(`[Task Architect] JSON: ${files.jsonPath}`);

    const document = await vscode.workspace.openTextDocument(files.markdownPath);
    await vscode.window.showTextDocument(document, { preview: false });
    this.postPlan(plan, files.markdownPath);
  }

  async openLastPlan() {
    const workspace = getWorkspaceRoot();
    if (!workspace) {
      vscode.window.showErrorMessage("Hãy mở workspace trước.");
      return;
    }

    const planFile = this.lastPlanFile || findLatestPlanFile(workspace);
    if (!planFile) {
      vscode.window.showInformationMessage("Chưa có kế hoạch nào trong .ai-agent/task-plans.");
      return;
    }

    const document = await vscode.workspace.openTextDocument(planFile);
    await vscode.window.showTextDocument(document, { preview: false });
    this.postState(`Đã mở kế hoạch: ${path.basename(planFile)}`);
  }

  /**
   * @param {string} text
   */
  postState(text) {
    this.view?.webview.postMessage({ type: "state", text });
  }

  /**
   * @param {TaskPlan} plan
   * @param {string} markdownPath
   */
  postPlan(plan, markdownPath) {
    this.view?.webview.postMessage({
      type: "plan",
      text: `Đã tạo ${countNodes(plan.modules)} nhiệm vụ xếp tầng bằng ${plan.generatedBy}.`,
      markdownPath,
      plan: toPlanPreview(plan)
    });
  }

  renderHtml() {
    const nonce = String(Date.now());
    const workspace = getWorkspaceRoot() || "Chưa mở workspace";
    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Agent Task Architect</title>
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
    h1 { margin: 0 0 6px; font-size: 18px; line-height: 1.25; }
    p { margin: 0; color: var(--muted); line-height: 1.45; }
    label { display: grid; gap: 6px; color: var(--muted); font-weight: 700; }
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
    textarea { min-height: 170px; resize: vertical; line-height: 1.5; }
    .workspace,
    .state,
    .preview {
      padding: 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--muted);
      line-height: 1.45;
    }
    .workspace {
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
    .preview { display: grid; gap: 8px; }
    .preview h2 { margin: 0; color: var(--fg); font-size: 14px; }
    .preview ol { margin: 0; padding-left: 18px; }
    .preview li { margin-top: 5px; color: var(--fg); }
    code { font-family: var(--vscode-editor-font-family); }
  </style>
</head>
<body>
  <main class="stack">
    <section class="hero">
      <h1>AI Agent Task Architect</h1>
      <p>Nhập prompt, AI phân tích và chia nhiệm vụ nhiều tầng. Không chạy terminal, không tự sửa code.</p>
    </section>

    <div class="workspace">${escapeHtml(workspace)}</div>

    <label>
      Độ chi tiết
      <select id="scale">
        <option value="auto">Tự chọn theo độ dài yêu cầu</option>
        <option value="small">Ngắn: 3 nhóm, ít mục con</option>
        <option value="medium">Vừa: 5 nhóm, nhiều mục con</option>
        <option value="deep">Rất chi tiết: 5 nhóm, tối đa 10 mục con/nhóm</option>
      </select>
    </label>

    <label>
      Prompt cần phân rã
      <textarea id="idea" placeholder="Ví dụ: Thêm chức năng quản lý dự án, AI hãy chia thành nhiều tầng nhiệm vụ thật nhỏ để model yếu cũng làm từng phần được..."></textarea>
    </label>

    <section class="actions">
      <button id="generate">Tạo cây nhiệm vụ</button>
      <button id="open" class="secondary">Mở kế hoạch gần nhất</button>
    </section>

    <div id="state" class="state">Sẵn sàng.</div>
    <section id="preview" class="preview" hidden></section>

    <p>Kết quả được lưu ở <code>.ai-agent/task-plans</code> gồm Markdown cho người dùng và JSON cho tooling.</p>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const idea = document.getElementById("idea");
    const scale = document.getElementById("scale");
    const state = document.getElementById("state");
    const preview = document.getElementById("preview");

    document.getElementById("generate").addEventListener("click", () => {
      vscode.postMessage({ type: "generate-plan", idea: idea.value, scale: scale.value });
    });

    document.getElementById("open").addEventListener("click", () => {
      vscode.postMessage({ type: "open-last-plan" });
    });

    window.addEventListener("message", (event) => {
      if (event.data?.type === "state") state.textContent = event.data.text;
      if (event.data?.type === "plan") {
        state.textContent = event.data.text;
        preview.hidden = false;
        preview.innerHTML = "<h2>" + escapeHtml(event.data.plan.title) + "</h2>" + renderPreview(event.data.plan.modules);
      }
    });

    function renderPreview(modules) {
      return "<ol>" + modules.map((item) => "<li><strong>" + escapeHtml(item.title) + "</strong><br><span>" + escapeHtml(item.objective) + "</span></li>").join("") + "</ol>";
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }
  </script>
</body>
</html>`;
  }
}

/**
 * @typedef {object} TaskNode
 * @property {string} id
 * @property {string} title
 * @property {string} objective
 * @property {string} prompt
 * @property {string[]} acceptance
 * @property {TaskNode[]} children
 */

/**
 * @typedef {object} TaskPlan
 * @property {string} title
 * @property {string} summary
 * @property {string} sourcePrompt
 * @property {string} scale
 * @property {string} generatedBy
 * @property {string[]} assumptions
 * @property {TaskNode[]} modules
 */

function getWorkspaceRoot() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * @param {{ idea: string; scale: ScaleProfile; workspaceSummary: string; config: vscode.WorkspaceConfiguration; output: vscode.OutputChannel }} input
 */
async function createPlanWithProvider(input) {
  const provider = input.config.get("provider", "auto");
  const openaiKey = input.config.get("openaiApiKey", "") || process.env.AI_AGENT_CODEX_API_KEY || process.env.OPENAI_API_KEY;
  const geminiKey = input.config.get("geminiApiKey", "") || process.env.GEMINI_API_KEY;

  if ((provider === "auto" || provider === "openai") && openaiKey) {
    try {
      const plan = await callOpenAiPlanner({
        apiKey: openaiKey,
        model: input.config.get("openaiModel", "gpt-5.4-mini"),
        idea: input.idea,
        scale: input.scale,
        workspaceSummary: input.workspaceSummary
      });
      return { provider: "openai", plan };
    } catch (error) {
      input.output.appendLine(`[Task Architect] OpenAI/Codex API lỗi: ${error.message}`);
      if (provider === "openai") throw error;
    }
  }

  if ((provider === "auto" || provider === "gemini") && geminiKey) {
    try {
      const plan = await callGeminiPlanner({
        apiKey: geminiKey,
        model: input.config.get("geminiModel", "gemini-2.5-flash"),
        idea: input.idea,
        scale: input.scale,
        workspaceSummary: input.workspaceSummary
      });
      return { provider: "gemini", plan };
    } catch (error) {
      input.output.appendLine(`[Task Architect] Gemini API lỗi: ${error.message}`);
      if (provider === "gemini") throw error;
    }
  }

  return {
    provider: "local",
    plan: buildLocalPlan(input.idea, input.scale, input.workspaceSummary)
  };
}

/**
 * @param {{ apiKey: string; model: string; idea: string; scale: ScaleProfile; workspaceSummary: string }} input
 */
async function callOpenAiPlanner(input) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: buildPlannerSystemPrompt(input.scale) },
        { role: "user", content: buildPlannerUserPrompt(input.idea, input.scale, input.workspaceSummary) }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `OpenAI HTTP ${response.status}`);
  return parseJsonPlan(data.choices?.[0]?.message?.content);
}

/**
 * @param {{ apiKey: string; model: string; idea: string; scale: ScaleProfile; workspaceSummary: string }} input
 */
async function callGeminiPlanner(input) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${buildPlannerSystemPrompt(input.scale)}\n\n${buildPlannerUserPrompt(input.idea, input.scale, input.workspaceSummary)}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini HTTP ${response.status}`);
  return parseJsonPlan(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

/**
 * @param {ScaleProfile} scale
 */
function buildPlannerSystemPrompt(scale) {
  return [
    "Bạn là AI Task Architect. Nhiệm vụ duy nhất: phân tích prompt và chia thành cây nhiệm vụ cực nhỏ, không viết code, không chạy terminal.",
    "Trả về DUY NHẤT JSON hợp lệ, không markdown, không giải thích ngoài JSON.",
    "Mỗi node phải có title, objective, prompt, acceptance, children.",
    "Prompt của mỗi node phải đủ cụ thể để một model AI yếu có thể làm riêng node đó.",
    "Không tạo nhiệm vụ tự code nếu người dùng chỉ yêu cầu lập kế hoạch.",
    `Độ chi tiết mục tiêu: ${scale.topLevel} nhóm lớn, tối đa ${scale.secondLevel} mục con mỗi nhóm, ${scale.leafLevel} mục rất nhỏ mỗi mục con.`,
    "Nếu yêu cầu ngắn, giảm số node hợp lý nhưng vẫn giữ cấu trúc xếp tầng rõ."
  ].join("\n");
}

/**
 * @param {string} idea
 * @param {ScaleProfile} scale
 * @param {string} workspaceSummary
 */
function buildPlannerUserPrompt(idea, scale, workspaceSummary) {
  return JSON.stringify(
    {
      sourcePrompt: idea,
      scale,
      workspaceSummary,
      outputShape: {
        title: "string",
        summary: "string",
        assumptions: ["string"],
        modules: [
          {
            id: "1",
            title: "string",
            objective: "string",
            prompt: "string",
            acceptance: ["string"],
            children: [
              {
                id: "1.1",
                title: "string",
                objective: "string",
                prompt: "string",
                acceptance: ["string"],
                children: []
              }
            ]
          }
        ]
      }
    },
    null,
    2
  );
}

/**
 * @param {string | undefined} text
 */
function parseJsonPlan(text) {
  if (!text) throw new Error("Provider không trả nội dung.");
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

/**
 * @typedef {{ name: string; topLevel: number; secondLevel: number; leafLevel: number }} ScaleProfile
 */

/**
 * @param {string} requestedScale
 * @param {string} idea
 * @returns {ScaleProfile}
 */
function resolveScale(requestedScale, idea) {
  if (requestedScale === "small") return { name: "small", topLevel: 3, secondLevel: 4, leafLevel: 2 };
  if (requestedScale === "medium") return { name: "medium", topLevel: 5, secondLevel: 6, leafLevel: 3 };
  if (requestedScale === "deep") return { name: "deep", topLevel: 5, secondLevel: 10, leafLevel: 4 };

  const score = idea.length + (idea.match(/,|\.|\n| và | thêm | sửa | tích hợp | quản lý | dashboard | api | dữ liệu/gi) || []).length * 40;
  if (score < 180) return { name: "auto-small", topLevel: 3, secondLevel: 3, leafLevel: 2 };
  if (score < 600) return { name: "auto-medium", topLevel: 5, secondLevel: 5, leafLevel: 3 };
  return { name: "auto-deep", topLevel: 5, secondLevel: 10, leafLevel: 4 };
}

/**
 * @param {unknown} value
 * @param {{ idea: string; scale: ScaleProfile; workspaceSummary: string; provider: string }} fallback
 * @returns {TaskPlan}
 */
function normalizePlan(value, fallback) {
  const source = isRecord(value) ? value : {};
  const modules = normalizeChildren(source.modules, fallback.scale, "module");
  return {
    title: readString(source.title) || inferTitle(fallback.idea),
    summary: readString(source.summary) || `Kế hoạch phân rã từ prompt: ${fallback.idea.slice(0, 180)}`,
    sourcePrompt: fallback.idea,
    scale: fallback.scale.name,
    generatedBy: fallback.provider,
    assumptions: readStringArray(source.assumptions, [
      "Chỉ chia nhiệm vụ và prompt, không tự sửa code.",
      "Mỗi nhiệm vụ nhỏ được thiết kế để giao riêng cho model yếu."
    ]),
    modules: modules.length ? modules : buildLocalPlan(fallback.idea, fallback.scale, fallback.workspaceSummary).modules
  };
}

/**
 * @param {unknown} value
 * @param {ScaleProfile} scale
 * @param {string} prefix
 * @returns {TaskNode[]}
 */
function normalizeChildren(value, scale, prefix) {
  const list = Array.isArray(value) ? value : [];
  if (prefix !== "module" && prefix.split(".").length >= 3) return [];
  const max = prefix === "module" ? scale.topLevel : prefix.split(".").length === 1 ? scale.secondLevel : scale.leafLevel;
  return list.slice(0, max).map((item, index) => {
    const record = isRecord(item) ? item : {};
    const id = readString(record.id) || (prefix === "module" ? `${index + 1}` : `${prefix}.${index + 1}`);
    return {
      id,
      title: readString(record.title) || `Nhiệm vụ ${id}`,
      objective: readString(record.objective) || "Làm rõ đầu ra cần đạt cho nhiệm vụ này.",
      prompt: readString(record.prompt) || "Phân tích yêu cầu của node này, thực hiện đúng phạm vi và trả lại kết quả ngắn gọn.",
      acceptance: readStringArray(record.acceptance, ["Có đầu ra rõ ràng.", "Không mở rộng ngoài phạm vi node."]),
      children: normalizeChildren(record.children, scale, id)
    };
  });
}

/**
 * @param {string} idea
 * @param {ScaleProfile} scale
 * @param {string} workspaceSummary
 * @returns {TaskPlan}
 */
function buildLocalPlan(idea, scale, workspaceSummary) {
  const moduleTemplates = [
    ["Phân tích yêu cầu", "Làm rõ mục tiêu, phạm vi, người dùng và đầu ra cần có."],
    ["Thiết kế cấu trúc nhiệm vụ", "Chuyển yêu cầu thành các nhóm việc độc lập, dễ giao cho model yếu."],
    ["Thiết kế trải nghiệm và dữ liệu", "Mô tả luồng, màn hình, dữ liệu, trạng thái và trường hợp biên cần tính."],
    ["Chuẩn bị prompt triển khai nhỏ", "Tạo prompt chi tiết cho từng phần nhỏ để AI khác có thể làm riêng."],
    ["Kiểm tra và nghiệm thu", "Chia nhỏ tiêu chí kiểm tra, review và bàn giao kết quả."]
  ];
  const secondTemplates = [
    "Xác định mục tiêu",
    "Xác định phạm vi không làm",
    "Tách đối tượng sử dụng",
    "Tách luồng chính",
    "Tách trạng thái dữ liệu",
    "Tách điểm tích hợp",
    "Tách rủi ro",
    "Tách tiêu chí nghiệm thu",
    "Tách prompt bàn giao",
    "Tách bước kiểm tra"
  ];
  const leafTemplates = [
    "Mô tả đầu vào cần có",
    "Mô tả thao tác hoặc phân tích cần làm",
    "Mô tả đầu ra phải trả về",
    "Mô tả cách tự kiểm tra kết quả"
  ];

  const modules = moduleTemplates.slice(0, scale.topLevel).map(([title, objective], moduleIndex) => ({
    id: `${moduleIndex + 1}`,
    title,
    objective,
    prompt: buildNodePrompt(idea, title, objective, "nhóm lớn", workspaceSummary),
    acceptance: [
      "Node có phạm vi rõ và không trùng node khác.",
      "Có thể giao node này cho một model yếu xử lý riêng."
    ],
    children: secondTemplates.slice(0, scale.secondLevel).map((childTitle, childIndex) => {
      const id = `${moduleIndex + 1}.${childIndex + 1}`;
      const childObjective = `${childTitle} cho nhóm "${title}" dựa trên prompt gốc.`;
      return {
        id,
        title: childTitle,
        objective: childObjective,
        prompt: buildNodePrompt(idea, childTitle, childObjective, "mục con", workspaceSummary),
        acceptance: [
          "Đầu ra đủ ngắn để ghép vào kế hoạch tổng.",
          "Không yêu cầu tự code hoặc chạy terminal."
        ],
        children: leafTemplates.slice(0, scale.leafLevel).map((leafTitle, leafIndex) => {
          const leafId = `${id}.${leafIndex + 1}`;
          const leafObjective = `${leafTitle} cho mục "${childTitle}".`;
          return {
            id: leafId,
            title: leafTitle,
            objective: leafObjective,
            prompt: buildNodePrompt(idea, leafTitle, leafObjective, "nhiệm vụ rất nhỏ", workspaceSummary),
            acceptance: [
              "Kết quả trả về trong phạm vi một nhiệm vụ nhỏ.",
              "Có thể dùng trực tiếp làm prompt cho model yếu."
            ],
            children: []
          };
        })
      };
    })
  }));

  return {
    title: inferTitle(idea),
    summary: "Kế hoạch local chia nhỏ prompt thành cây nhiệm vụ nhiều tầng khi chưa cấu hình AI API.",
    sourcePrompt: idea,
    scale: scale.name,
    generatedBy: "local",
    assumptions: [
      "Chưa có API key hoặc provider lỗi nên dùng bộ chia local.",
      "Kế hoạch chỉ phục vụ phân tích và giao việc, không tự sửa code."
    ],
    modules
  };
}

function buildNodePrompt(sourcePrompt, title, objective, level, workspaceSummary) {
  return [
    `Bạn nhận một ${level} trong cây nhiệm vụ.`,
    `Tiêu đề: ${title}`,
    `Mục tiêu: ${objective}`,
    `Prompt gốc: ${sourcePrompt}`,
    `Ngữ cảnh workspace: ${workspaceSummary}`,
    "Chỉ xử lý đúng nhiệm vụ này. Không tự code, không chạy terminal, không mở rộng sang node khác.",
    "Trả về: phân tích ngắn, checklist việc cần làm, đầu ra mong đợi."
  ].join("\n");
}

/**
 * @param {string} workspace
 * @param {TaskPlan} plan
 */
async function writePlanFiles(workspace, plan) {
  const planDir = path.join(workspace, PLAN_DIR);
  await fs.promises.mkdir(planDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = safeSlug(plan.title);
  const jsonPath = path.join(planDir, `${stamp}-${slug}.json`);
  const markdownPath = path.join(planDir, `${stamp}-${slug}.md`);
  await fs.promises.writeFile(jsonPath, JSON.stringify(plan, null, 2), "utf8");
  await fs.promises.writeFile(markdownPath, renderMarkdownPlan(plan), "utf8");
  return { jsonPath, markdownPath };
}

/**
 * @param {TaskPlan} plan
 */
function renderMarkdownPlan(plan) {
  const lines = [
    `# ${plan.title}`,
    "",
    `Nguồn: ${plan.generatedBy}`,
    `Độ chi tiết: ${plan.scale}`,
    "",
    "## Prompt gốc",
    "",
    plan.sourcePrompt,
    "",
    "## Tóm tắt",
    "",
    plan.summary,
    "",
    "## Giả định",
    "",
    ...plan.assumptions.map((item) => `- ${item}`),
    "",
    "## Cây nhiệm vụ",
    ""
  ];

  for (const node of plan.modules) {
    renderNodeMarkdown(lines, node, 2);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * @param {string[]} lines
 * @param {TaskNode} node
 * @param {number} depth
 */
function renderNodeMarkdown(lines, node, depth) {
  lines.push(`${"#".repeat(Math.min(depth, 6))} ${node.id}. ${node.title}`);
  lines.push("");
  lines.push(`Mục tiêu: ${node.objective}`);
  lines.push("");
  lines.push("Prompt giao cho model yếu:");
  lines.push("");
  lines.push("```txt");
  lines.push(node.prompt);
  lines.push("```");
  lines.push("");
  lines.push("Tiêu chí nghiệm thu:");
  lines.push("");
  for (const item of node.acceptance) lines.push(`- ${item}`);
  lines.push("");
  for (const child of node.children) renderNodeMarkdown(lines, child, depth + 1);
}

function summarizeWorkspace(workspace) {
  const lines = [];
  const packageJsonPath = path.join(workspace, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      lines.push(`package=${pkg.name || "unknown"}`);
      lines.push(`scripts=${Object.keys(pkg.scripts || {}).join(", ") || "none"}`);
      lines.push(`dependencies=${Object.keys(pkg.dependencies || {}).slice(0, 12).join(", ") || "none"}`);
    } catch (error) {
      lines.push(`package.json read error=${error.message}`);
    }
  }

  const candidates = ["README.md", "tsconfig.json", "next.config.js", "next.config.mjs", "vite.config.ts", "src", "app", "components", "lib", "packages"];
  const existing = candidates.filter((item) => fs.existsSync(path.join(workspace, item)));
  lines.push(`detected=${existing.join(", ") || "none"}`);
  return lines.join("; ");
}

function findLatestPlanFile(workspace) {
  const planDir = path.join(workspace, PLAN_DIR);
  if (!fs.existsSync(planDir)) return undefined;
  const files = fs
    .readdirSync(planDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join(planDir, file))
    .sort();
  return files.at(-1);
}

/**
 * @param {TaskNode[]} nodes
 */
function countNodes(nodes) {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

/**
 * @param {TaskPlan} plan
 */
function toPlanPreview(plan) {
  return {
    title: plan.title,
    modules: plan.modules.map((item) => ({
      title: item.title,
      objective: item.objective
    }))
  };
}

function inferTitle(idea) {
  const compact = idea.replace(/\s+/g, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 72)}...` : compact || "Kế hoạch nhiệm vụ";
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value, fallback) {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : fallback;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeSlug(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "task-plan";
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
