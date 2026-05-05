"use client";

import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileJson,
  FolderOpen,
  GitBranch,
  Layers3,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  Route,
  Save,
  Send,
  Sparkles,
  TerminalSquare,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ArtifactType,
  Project,
  ProjectArtifact,
  ProjectBlueprint
} from "@/packages/schemas/project-blueprint.schema";
import { TerminalWindow } from "@/components/TerminalWindow";

type TabId = "analysis" | "codebase" | "features" | "architecture" | "roadmap" | "tasks" | "prompts" | "execution" | "logs";

type CodexStatus = {
  command: string;
  available: boolean;
  version: string;
  loggedIn: boolean;
  loginStatus: string;
  executorEnabled: boolean;
};

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "analysis", label: "Phân tích", icon: Sparkles },
  { id: "codebase", label: "Mã nguồn", icon: FolderOpen },
  { id: "features", label: "Chức năng", icon: Layers3 },
  { id: "architecture", label: "Kiến trúc", icon: GitBranch },
  { id: "roadmap", label: "Lộ trình", icon: Route },
  { id: "tasks", label: "Tác vụ", icon: ListChecks },
  { id: "prompts", label: "Prompt AI", icon: Code2 },
  { id: "execution", label: "Thực thi", icon: Play },
  { id: "logs", label: "Nhật ký", icon: TerminalSquare }
];

const artifactByTab: Partial<Record<TabId, ArtifactType>> = {
  analysis: "requirements",
  codebase: "codebase_context",
  features: "feature_discovery",
  architecture: "architecture_plan",
  roadmap: "roadmap",
  tasks: "task_plan",
  prompts: "execution_prompt",
  execution: "review_report"
};

const requiredApprovals: ArtifactType[] = [
  "requirements",
  "feature_discovery",
  "architecture_plan",
  "task_plan",
  "execution_prompt"
];

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
  const [rawIdea, setRawIdea] = useState(
    "Xây dựng hệ thống AI Agent tổng quát: người dùng nhập ý tưởng thô, agent tự phân tích loại dự án, đề xuất chức năng, kiến trúc, lộ trình, tác vụ, prompt, cho duyệt rồi thực thi và đánh giá."
  );
  const [projectMode, setProjectMode] = useState<"new_project" | "existing_project">("new_project");
  const [sourcePath, setSourcePath] = useState("/Applications/du-an/AI-agent");
  const [autoAssume, setAutoAssume] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("analysis");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editorArtifactId, setEditorArtifactId] = useState("");
  const [editorText, setEditorText] = useState("");
  const [codexStatus, setCodexStatus] = useState<CodexStatus | null>(null);
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexError, setCodexError] = useState("");
  const [autoPilot, setAutoPilot] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    void loadProjects();
    void loadCodexStatus();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void loadBlueprint(selectedProjectId);
    }
  }, [selectedProjectId]);

  const latestArtifacts = useMemo(() => getLatestArtifacts(blueprint?.artifacts ?? []), [blueprint]);
  const currentArtifact = latestArtifacts[artifactByTab[activeTab] ?? "requirements"];
  const approvalTypes = useMemo<ArtifactType[]>(
    () => (blueprint?.project.mode === "existing_project" ? ["codebase_context", ...requiredApprovals] : requiredApprovals),
    [blueprint?.project.mode]
  );
  const approvals = useMemo(() => {
    return {
      done: approvalTypes.filter((type) => latestArtifacts[type]?.approvedByUser === true).length,
      total: approvalTypes.length,
      ready: approvalTypes.every((type) => latestArtifacts[type]?.approvedByUser === true)
    };
  }, [approvalTypes, latestArtifacts]);
  const approvalPercent = approvals.total > 0 ? Math.round((approvals.done / approvals.total) * 100) : 0;

  async function loadProjects() {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const data = await response.json();
    setProjects(data.projects ?? []);
    if (!selectedProjectId && data.projects?.[0]) {
      setSelectedProjectId(data.projects[0].id);
    }
  }

  async function loadBlueprint(projectId = selectedProjectId) {
    if (!projectId) return;
    const response = await fetch(`/api/projects/${projectId}/blueprint`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setBlueprint(data.blueprint);
  }

  async function loadCodexStatus() {
    setCodexBusy(true);
    setCodexError("");
    try {
      const response = await fetch("/api/codex/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Không đọc được trạng thái Codex CLI.");
      }
      setCodexStatus(data);
    } catch (error) {
      setCodexStatus(null);
      setCodexError(error instanceof Error ? toVietnameseMessage(error.message) : "Không đọc được trạng thái Codex CLI.");
    } finally {
      setCodexBusy(false);
    }
  }

  async function createAndAnalyze() {
    setBusy(true);
    setNotice("");
    try {
      const created = await apiPost("/api/projects", {
        rawIdea,
        autoAssume,
        mode: projectMode,
        sourcePath: projectMode === "existing_project" ? sourcePath : undefined
      });
      const project = created.project as Project;
      setSelectedProjectId(project.id);
      if (projectMode === "existing_project") {
        await apiPost(`/api/projects/${project.id}/codebase`, { sourcePath });
      }
      const analyzed = await apiPost(`/api/projects/${project.id}/analyze`, { autoAssume });
      setBlueprint(analyzed.blueprint);
      await loadProjects();
      setActiveTab("analysis");
      
      if (autoPilot) {
        void runAutoPilot(project, analyzed.blueprint);
      } else {
        setNotice("Đã tạo blueprint và đang chờ duyệt.");
        setBusy(false);
      }
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Có lỗi khi tạo dự án.");
      setBusy(false);
    }
  }

  async function runAutoPilot(project: Project, newBlueprint: ProjectBlueprint) {
    setNotice("Auto-Pilot: Đang tự động duyệt các tài liệu...");
    try {
      const typesToApprove = project.mode === "existing_project" ? ["codebase_context", ...requiredApprovals] : requiredApprovals;
      const artifactsToApprove = newBlueprint.artifacts.filter((a: ProjectArtifact) => typesToApprove.includes(a.artifactType) && !a.approvedByUser);
      
      for (const artifact of artifactsToApprove) {
        await apiPost(`/api/projects/${project.id}/artifacts/${artifact.id}/approve`, {});
      }
      
      setNotice("Auto-Pilot: Bắt đầu thực thi...");
      setActiveTab("logs");
      setIsExecuting(true);
      
      const interval = setInterval(() => {
        void loadBlueprint(project.id);
      }, 2000);
      
      try {
        await apiPost(`/api/projects/${project.id}/execute`, {});
      } finally {
        clearInterval(interval);
        await loadBlueprint(project.id);
        setIsExecuting(false);
        setNotice("Agent thực thi xong tự động!");
      }
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Lỗi Auto-Pilot");
      setIsExecuting(false);
    } finally {
      setBusy(false);
    }
  }

  async function rerunAnalysis() {
    if (!blueprint) return;
    setBusy(true);
    setNotice("");
    try {
      const analyzed = await apiPost(`/api/projects/${blueprint.project.id}/analyze`, { autoAssume });
      setBlueprint(analyzed.blueprint);
      await loadProjects();
      setNotice("Đã chạy lại luồng agent.");
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Không chạy lại được phần phân tích.");
    } finally {
      setBusy(false);
    }
  }

  function openEditor(artifact?: ProjectArtifact) {
    if (!artifact) return;
    setEditorArtifactId(artifact.id);
    setEditorText(JSON.stringify(artifact.content, null, 2));
  }

  async function saveArtifact() {
    if (!blueprint || !editorArtifactId) return;
    setBusy(true);
    setNotice("");
    try {
      const parsed = JSON.parse(editorText);
      await apiPatch(`/api/projects/${blueprint.project.id}/artifacts/${editorArtifactId}`, { content: parsed });
      await loadBlueprint();
      setNotice("Đã lưu tài liệu. Cần duyệt lại trước khi thực thi.");
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "JSON không hợp lệ hoặc lưu thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function approveArtifact(artifact?: ProjectArtifact) {
    if (!blueprint || !artifact) return;
    setBusy(true);
    setNotice("");
    try {
      await apiPost(`/api/projects/${blueprint.project.id}/artifacts/${artifact.id}/approve`, {});
      await loadBlueprint();
      setNotice(`Đã duyệt ${formatArtifactType(artifact.artifactType)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Duyệt tài liệu thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function approveAll() {
    if (!blueprint) return;
    setBusy(true);
    setNotice("");
    try {
      for (const type of approvalTypes) {
        const artifact = latestArtifacts[type];
        if (artifact && !artifact.approvedByUser) {
          await apiPost(`/api/projects/${blueprint.project.id}/artifacts/${artifact.id}/approve`, {});
        }
      }
      await loadBlueprint();
      setNotice("Đã duyệt các tài liệu cần thiết.");
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Duyệt tất cả tài liệu thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    if (!blueprint) return;
    setBusy(true);
    setIsExecuting(true);
    setNotice("");
    setActiveTab("logs");
    
    const interval = setInterval(() => {
      void loadBlueprint(blueprint.project.id);
    }, 2000);
    
    try {
      await apiPost(`/api/projects/${blueprint.project.id}/execute`, {});
      setNotice("Agent thực thi đã tạo kết quả trong thư mục làm việc.");
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Thực thi thất bại.");
    } finally {
      clearInterval(interval);
      await loadBlueprint(blueprint.project.id);
      setIsExecuting(false);
      setBusy(false);
    }
  }

  async function cancelExecution() {
    if (!blueprint) return;
    setBusy(true);
    setNotice("Đang hủy tiến trình...");
    try {
      await apiPost(`/api/projects/${blueprint.project.id}/cancel`, {});
      await loadBlueprint(blueprint.project.id);
      setNotice("Đã gửi lệnh hủy. Hãy đợi vài giây để luồng dừng hẳn.");
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Hủy thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    if (!blueprint) return;
    setBusy(true);
    setNotice("");
    try {
      await apiPost(`/api/projects/${blueprint.project.id}/review`, {});
      await loadBlueprint();
      setActiveTab("execution");
      setNotice("Agent đánh giá đã tạo báo cáo.");
    } catch (error) {
      setNotice(error instanceof Error ? toVietnameseMessage(error.message) : "Đánh giá thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Bot size={24} />
          <div>
            <strong>Hệ thống AI Agent</strong>
            <span>Bảng điều khiển MVP</span>
          </div>
        </div>

        <section className="ideaPanel">
          <label htmlFor="rawIdea">Ý tưởng dự án</label>
          <div className="modeSwitch" role="group" aria-label="Chế độ dự án">
            <button
              type="button"
              className={projectMode === "new_project" ? "active" : ""}
              onClick={() => setProjectMode("new_project")}
            >
              Tạo mới
            </button>
            <button
              type="button"
              className={projectMode === "existing_project" ? "active" : ""}
              onClick={() => setProjectMode("existing_project")}
            >
              Sửa repo
            </button>
          </div>
          <textarea
            id="rawIdea"
            value={rawIdea}
            onChange={(event) => setRawIdea(event.target.value)}
            rows={8}
            placeholder="Nhập ý tưởng thô về web app, bot, game, công cụ tự động hóa..."
          />
          {projectMode === "existing_project" ? (
            <input
              className="pathInput"
              value={sourcePath}
              onChange={(event) => setSourcePath(event.target.value)}
              placeholder="/đường/dẫn/tới/repo"
            />
          ) : null}
          <label className="checkLine">
            <input type="checkbox" checked={autoAssume} onChange={(event) => setAutoAssume(event.target.checked)} />
            <span>Tự giả định khi thiếu thông tin nhỏ</span>
          </label>
          <label className="checkLine" style={{ marginTop: '8px' }}>
            <input type="checkbox" checked={autoPilot} onChange={(event) => setAutoPilot(event.target.checked)} />
            <span>Chế độ Auto-Pilot (Bỏ qua duyệt, xem Terminal)</span>
          </label>
          <button
            className="primary"
            onClick={createAndAnalyze}
            disabled={busy || rawIdea.trim().length < 8 || (projectMode === "existing_project" && !sourcePath.trim())}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            {projectMode === "existing_project" ? "Quét và lập kế hoạch" : "Tạo blueprint"}
          </button>
        </section>

        <CodexCliPanel
          status={codexStatus}
          error={codexError}
          loading={codexBusy}
          onRefresh={() => void loadCodexStatus()}
        />

        <section className="projectList">
          <div className="sectionTitle">Dự án</div>
          {projects.length === 0 ? (
            <p className="muted">Chưa có dự án nào.</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                className={`projectButton ${project.id === selectedProjectId ? "active" : ""}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <span>{project.name}</span>
                <small>
                  {formatProjectMode(project.mode ?? "new_project")} · {formatProjectType(project.projectType)} · {formatProjectStatus(project.status)}
                </small>
              </button>
            ))
          )}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Điều phối agent tổng quát</p>
            <h1>{blueprint?.project.name ?? "Tạo dự án mới để bắt đầu"}</h1>
            {blueprint ? (
              <p className="subline">
                {formatProjectType(blueprint.project.projectType)} · độ tin cậy {Math.round(blueprint.project.confidence * 100)}% ·{" "}
                {formatProjectStatus(blueprint.project.status)}
                {blueprint.project.mode === "existing_project" && blueprint.project.sourcePath ? ` · ${blueprint.project.sourcePath}` : ""}
              </p>
            ) : (
              <p className="subline">Chưa có dự án đang chọn.</p>
            )}
          </div>
          <div className="topActions">
            <button className="secondary" onClick={rerunAnalysis} disabled={busy || !blueprint}>
              <RefreshCw size={16} />
              Chạy lại
            </button>
            <button className="secondary" onClick={approveAll} disabled={busy || !blueprint}>
              <CheckCircle2 size={16} />
              Duyệt tất cả
            </button>
            <button
              className="primary"
              onClick={execute}
              disabled={busy || !blueprint || !approvals.ready}
              title={approvals.ready ? "Chạy Agent thực thi" : "Cần duyệt tất cả tài liệu trước khi thực thi"}
            >
              <Play size={16} />
              Thực thi
            </button>
            <button className="secondary" onClick={review} disabled={busy || !blueprint}>
              <ClipboardList size={16} />
              Đánh giá
            </button>
            <button className="secondary" onClick={cancelExecution} disabled={!busy || !blueprint || blueprint.project.status !== "executing"} style={{ color: "#ff5f56", borderColor: "#ff5f56" }}>
              <div style={{ width: "12px", height: "12px", backgroundColor: "#ff5f56", borderRadius: "2px" }} />
              Dừng chạy
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}

        {blueprint ? (
          <section className="statusStrip" aria-label="Trạng thái quy trình">
            <div className="statusCard">
              <span>Cổng duyệt</span>
              <strong>
                {approvals.done}/{approvals.total} đã duyệt
              </strong>
              <div className="progressTrack" aria-label={`Tiến độ duyệt ${approvalPercent}%`}>
                <i style={{ width: `${approvalPercent}%` }} />
              </div>
            </div>
            <div className="statusCard">
              <span>Bộ thực thi Codex</span>
              <strong>{codexStatus?.executorEnabled ? "Đang bật" : "Chưa bật"}</strong>
              <small>{codexStatus?.loggedIn ? codexStatus.version : "Cần đăng nhập"}</small>
            </div>
            <div className="statusCard">
              <span>Tài liệu hiện tại</span>
              <strong>{currentArtifact ? formatArtifactType(currentArtifact.artifactType) : "Không có"}</strong>
              <small>{currentArtifact?.approvedByUser ? "Sẵn sàng thực thi" : "Đang chờ duyệt"}</small>
            </div>
          </section>
        ) : null}

        <nav className="tabs" aria-label="Các tab bảng điều khiển">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {blueprint ? (
          <div className="contentGrid">
            <section className="mainPanel">
              <TabContent tab={activeTab} blueprint={blueprint} latestArtifacts={latestArtifacts} isExecuting={isExecuting} />
            </section>
            <aside className="inspector">
              <div className="metricRow">
                <div>
                  <span>Duyệt</span>
                  <strong>
                    {approvals.done}/{approvals.total}
                  </strong>
                </div>
                <div>
                  <span>Tác vụ</span>
                  <strong>{blueprint.tasks.length}</strong>
                </div>
                <div>
                  <span>Lượt chạy</span>
                  <strong>{blueprint.agentRuns.length}</strong>
                </div>
              </div>

              <div className="artifactHeader">
                <div>
                  <span>Tài liệu hiện tại</span>
                  <strong>{currentArtifact ? formatArtifactType(currentArtifact.artifactType) : "Không có"}</strong>
                </div>
                {currentArtifact ? (
                  <span className={currentArtifact.approvedByUser ? "pill ok" : "pill wait"}>
                    {currentArtifact.approvedByUser ? "đã duyệt" : "đang chờ"}
                  </span>
                ) : null}
              </div>

              <div className="inspectorActions">
                <button className="secondary" onClick={() => openEditor(currentArtifact)} disabled={!currentArtifact || busy}>
                  <FileJson size={16} />
                  Mở JSON
                </button>
                <button className="secondary" onClick={() => approveArtifact(currentArtifact)} disabled={!currentArtifact || busy}>
                  <CheckCircle2 size={16} />
                  Duyệt
                </button>
              </div>

              {editorArtifactId ? (
                <div className="jsonEditor">
                  <textarea value={editorText} onChange={(event) => setEditorText(event.target.value)} rows={18} />
                  <button className="primary" onClick={saveArtifact} disabled={busy}>
                    <Save size={16} />
                    Lưu thay đổi
                  </button>
                </div>
              ) : (
                <pre className="jsonPreview">{safeJson(currentArtifact?.content ?? blueprint.intentAnalysis ?? {})}</pre>
              )}
            </aside>
          </div>
        ) : (
          <div className="emptyState">
            <Wand2 size={28} />
            <strong>Chưa có blueprint</strong>
            <span>Không gian lập kế hoạch</span>
          </div>
        )}
      </section>
    </main>
  );
}

function CodexCliPanel({
  status,
  error,
  loading,
  onRefresh
}: {
  status: CodexStatus | null;
  error: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  const loginLabel = status?.loggedIn ? "đã đăng nhập" : "chưa đăng nhập";
  const executorLabel = status?.executorEnabled ? "Codex" : "Gemini API";

  return (
    <section className="codexPanel">
      <div className="codexHeader">
        <div className="codexTitle">
          <TerminalSquare size={18} />
          <div>
            <strong>Codex CLI</strong>
            <small>Bộ thực thi</small>
          </div>
        </div>
        <button className="sidebarIconButton" type="button" onClick={onRefresh} disabled={loading} aria-label="Làm mới Codex CLI">
          {loading ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
        </button>
      </div>

      {error ? (
        <div className="codexError">{error}</div>
      ) : (
        <>
          <div className="codexStatusLine">
            <strong>{status?.command ?? "codex"}</strong>
            <span className={status?.available ? "pill ok" : "pill bad"}>{status?.available ? "khả dụng" : "thiếu"}</span>
          </div>

          <div className="codexFacts">
            <div>
              <span>Đăng nhập</span>
              <strong>{loginLabel}</strong>
            </div>
            <div>
              <span>Bộ thực thi</span>
              <strong>{executorLabel}</strong>
            </div>
            <div>
              <span>Phiên bản</span>
              <strong>{status?.version || "chưa rõ"}</strong>
            </div>
            <div>
              <span>Đang bật</span>
              <strong>{status?.executorEnabled ? "có" : "không"}</strong>
            </div>
          </div>

          {status?.loginStatus ? <pre className="codexLog">{status.loginStatus}</pre> : null}

          <div className="codexCommands">
            <code>AI_AGENT_EXECUTOR=codex npm run dev:clean -- --hostname 127.0.0.1 --port 3100</code>
            <code>codex logout && codex login</code>
          </div>
        </>
      )}
    </section>
  );
}

function TabContent({
  tab,
  blueprint,
  latestArtifacts,
  isExecuting
}: {
  tab: TabId;
  blueprint: ProjectBlueprint;
  latestArtifacts: Partial<Record<ArtifactType, ProjectArtifact>>;
  isExecuting: boolean;
}) {
  if (tab === "analysis") {
    return (
      <div className="stack">
        <PanelTitle title="Bản phân tích" subtitle="Ý định và yêu cầu" />
        <div className="infoGrid">
          <InfoBlock label="Loại dự án" value={formatProjectType(blueprint.intentAnalysis?.projectType ?? "unknown")} />
          <InfoBlock label="Độ tin cậy" value={`${Math.round((blueprint.intentAnalysis?.confidence ?? 0) * 100)}%`} />
          <InfoBlock label="Nền tảng" value={(blueprint.intentAnalysis?.targetPlatforms ?? []).join(", ") || "Chưa rõ"} />
        </div>
        <TextSection title="Lý do nhận diện" value={blueprint.intentAnalysis?.reasoning} />
        <ListSection title="Người dùng mục tiêu" items={blueprint.requirements?.targetUsers} />
        <TextSection title="Vấn đề cần giải quyết" value={blueprint.requirements?.problemStatement} />
        <ListSection title="Câu hỏi khi thiếu thông tin" items={blueprint.intentAnalysis?.missingQuestions} />
        <ListSection title="Giả định" items={blueprint.intentAnalysis?.initialAssumptions} />
      </div>
    );
  }

  if (tab === "codebase") {
    const context = blueprint.codebaseContext;
    return (
      <div className="stack">
        <PanelTitle title="Ngữ cảnh mã nguồn" subtitle="Quét dự án có sẵn" />
        <div className="infoGrid">
          <InfoBlock label="Chế độ" value={formatProjectMode(blueprint.project.mode ?? "new_project")} />
          <InfoBlock label="Số file" value={`${context?.stats.fileCount ?? 0}`} />
          <InfoBlock label="Trình quản lý gói" value={context?.packageManager ?? "Chưa rõ"} />
        </div>
        <TextSection title="Đường dẫn nguồn" value={context?.sourcePath ?? blueprint.project.sourcePath} />
        <ListSection title="Dấu hiệu framework" items={context?.frameworkSignals} />
        <ListSection title="Ngôn ngữ" items={context?.languages} />
        <JsonSection title="Script" value={context?.scripts ?? {}} />
        <JsonSection title="Lệnh phát hiện được" value={context?.detectedCommands ?? {}} />
        <ListSection title="File quan trọng" items={context?.keyFiles} />
        <ListSection title="Rủi ro" items={context?.risks} />
      </div>
    );
  }

  if (tab === "features") {
    return (
      <div className="stack">
        <PanelTitle title="Chức năng AI đề xuất" subtitle="Tài liệu khám phá chức năng" />
        <ListSection title="Chức năng cốt lõi" items={blueprint.featureDiscovery?.coreFeatures} />
        <ListSection title="Chức năng tùy chọn" items={blueprint.featureDiscovery?.optionalFeatures} />
        <JsonSection title="Thiết kế theo loại dự án" value={blueprint.featureDiscovery?.typeSpecific} />
        <ListSection title="Loại trừ có chủ ý" items={blueprint.featureDiscovery?.excludedByDesign} />
      </div>
    );
  }

  if (tab === "architecture") {
    const plan = blueprint.architecturePlan;
    return (
      <div className="stack">
        <PanelTitle title="Bộ lập kế hoạch kiến trúc" subtitle="Tài liệu kiến trúc" />
        <TextSection title="Tổng quan" value={plan?.overview} />
        <DecisionGrid
          items={[
            ["Frontend", plan?.frontend?.recommended, plan?.frontend?.rationale, plan?.frontend?.stack],
            ["Backend", plan?.backend?.recommended, plan?.backend?.rationale, plan?.backend?.stack],
            ["API", plan?.api?.recommended, plan?.api?.rationale, plan?.api?.style ? [plan.api.style] : []],
            ["Database", plan?.database?.recommended, plan?.database?.rationale, plan?.database?.options]
          ]}
        />
        <ListSection title="Môi trường chạy" items={plan?.runtime} />
        <ListSection title="Tích hợp" items={plan?.integrations} />
        <ListSection title="Rủi ro" items={plan?.risks} />
      </div>
    );
  }

  if (tab === "roadmap") {
    return (
      <div className="stack">
        <PanelTitle title="Lộ trình" subtitle="Các mốc triển khai" />
        <div className="timeline">
          {(blueprint.roadmap ?? []).map((milestone, index) => (
            <article key={milestone.id} className="timelineItem">
              <span>{index + 1}</span>
              <div>
                <h3>{milestone.title}</h3>
                <p>{milestone.objective}</p>
                <ListSection title="Đầu ra" items={milestone.deliverables} compact />
                <ListSection title="Điều kiện hoàn tất" items={milestone.exitCriteria} compact />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "tasks") {
    return (
      <div className="stack">
        <PanelTitle title="Kế hoạch tác vụ" subtitle="Phân rã công việc" />
        <div className="taskList">
          {blueprint.tasks.map((task) => (
            <article key={task.id} className="taskItem">
              <div>
                <h3>{task.title}</h3>
                <p>{task.objective}</p>
              </div>
              <div className="taskMeta">
                <span>{task.taskType}</span>
                <span>{task.targetArea}</span>
                <span>{formatTaskStatus(task.status)}</span>
              </div>
              <ListSection title="Tiêu chí nghiệm thu" items={task.acceptanceCriteria} compact />
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "prompts") {
    return (
      <div className="stack">
        <PanelTitle title="Bộ soạn prompt" subtitle="Tài liệu prompt thực thi" />
        {(blueprint.executionPrompts ?? []).map((item) => (
          <article key={item.taskId} className="promptBlock">
            <h3>{item.title}</h3>
            <pre>{item.prompt}</pre>
            <ListSection title="Checklist đánh giá" items={item.reviewChecklist} compact />
          </article>
        ))}
      </div>
    );
  }

  if (tab === "execution") {
    const execution = latestArtifacts.execution_result;
    const review = latestArtifacts.review_report;
    return (
      <div className="stack">
        <PanelTitle title="Thực thi và đánh giá" subtitle="Kết quả thư mục làm việc và báo cáo đánh giá" />
        <JsonSection title="Kết quả thực thi" value={execution?.content ?? { status: "Chưa thực thi" }} />
        <JsonSection title="Báo cáo đánh giá" value={review?.content ?? { status: "Chưa đánh giá" }} />
        <JsonSection title="Prompt sửa lỗi" value={latestArtifacts.fix_prompt?.content ?? { status: "Không có prompt sửa lỗi" }} />
      </div>
    );
  }

  return (
    <div className="stack">
      <PanelTitle title="Nhật ký chạy ngầm" subtitle="Mô phỏng Terminal trực tiếp" />
      <TerminalWindow logs={blueprint.logs} isRunning={isExecuting} />
      
      <PanelTitle title="Lịch sử lượt chạy" subtitle="Các tác vụ đã kích hoạt" />
      <div className="runGrid">
        {blueprint.agentRuns.map((run) => (
          <article key={run.id} className="runItem">
            <strong>{formatAgentName(run.agentName)}</strong>
            <span className={`pill ${run.status === "completed" ? "ok" : run.status === "failed" ? "bad" : "wait"}`}>
              {formatRunStatus(run.status)}
            </span>
            <small>{formatDate(run.startedAt)}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="panelTitle">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoBlock">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextSection({ title, value }: { title: string; value?: string }) {
  return (
    <section className="textSection">
      <h3>{title}</h3>
      <p>{value || "Chưa có dữ liệu."}</p>
    </section>
  );
}

function ListSection({ title, items, compact = false }: { title: string; items?: string[]; compact?: boolean }) {
  const safeItems = items?.length ? items : ["Chưa có dữ liệu."];
  return (
    <section className={compact ? "listSection compact" : "listSection"}>
      <h3>{title}</h3>
      <ul>
        {safeItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="jsonSection">
      <h3>{title}</h3>
      <pre>{safeJson(value)}</pre>
    </section>
  );
}

function DecisionGrid({
  items
}: {
  items: Array<[string, boolean | undefined, string | undefined, string[] | undefined]>;
}) {
  return (
    <div className="decisionGrid">
      {items.map(([label, recommended, rationale, stack]) => (
        <article key={label} className="decisionItem">
          <div>
            <strong>{label}</strong>
            <span className={recommended ? "pill ok" : "pill wait"}>{recommended ? "đề xuất" : "không cần"}</span>
          </div>
          <p>{rationale || "Chưa có lý do."}</p>
          {stack?.length ? <small>{stack.join(" · ")}</small> : null}
        </article>
      ))}
    </div>
  );
}

async function apiPost(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Yêu cầu thất bại");
  }
  return data;
}

async function apiPatch(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Yêu cầu thất bại");
  }
  return data;
}

function getLatestArtifacts(artifacts: ProjectArtifact[]) {
  return artifacts.reduce<Partial<Record<ArtifactType, ProjectArtifact>>>((acc, artifact) => {
    const current = acc[artifact.artifactType];
    if (!current || artifact.version > current.version) {
      acc[artifact.artifactType] = artifact;
    }
    return acc;
  }, {});
}

function safeJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatProjectType(value: string) {
  const labels: Record<string, string> = {
    web_app: "Ứng dụng web",
    mobile_app: "Ứng dụng di động",
    saas: "SaaS",
    bot: "Bot",
    automation_tool: "Công cụ tự động hóa",
    game: "Game",
    ai_tool: "Công cụ AI",
    trading_bot: "Bot giao dịch",
    landing_page: "Landing page",
    unknown: "Chưa rõ loại"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatProjectMode(value: string) {
  const labels: Record<string, string> = {
    new_project: "Dự án mới",
    existing_project: "Repo có sẵn"
  };
  return labels[value] ?? value;
}

function formatProjectStatus(value: string) {
  const labels: Record<string, string> = {
    draft: "Bản nháp",
    analyzing: "Đang phân tích",
    awaiting_clarification: "Đang chờ làm rõ",
    awaiting_approval: "Đang chờ duyệt",
    approved: "Đã duyệt",
    executing: "Đang thực thi",
    reviewing: "Đang đánh giá",
    needs_fix: "Cần sửa",
    completed: "Hoàn tất",
    failed: "Thất bại"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatArtifactType(value: string) {
  const labels: Record<string, string> = {
    intent_analysis: "Phân tích ý định",
    requirements: "Yêu cầu",
    feature_discovery: "Khám phá chức năng",
    architecture_plan: "Kế hoạch kiến trúc",
    roadmap: "Lộ trình",
    task_plan: "Kế hoạch tác vụ",
    execution_prompt: "Prompt thực thi",
    execution_result: "Kết quả thực thi",
    review_report: "Báo cáo đánh giá",
    fix_prompt: "Prompt sửa lỗi",
    codebase_context: "Ngữ cảnh mã nguồn"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatTaskStatus(value: string) {
  const labels: Record<string, string> = {
    pending: "Đang chờ",
    running: "Đang chạy",
    completed: "Hoàn tất",
    failed: "Thất bại",
    skipped: "Bỏ qua"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatRunStatus(value: string) {
  const labels: Record<string, string> = {
    running: "đang chạy",
    completed: "hoàn tất",
    failed: "thất bại"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatLogLevel(value: string) {
  const labels: Record<string, string> = {
    info: "thông tin",
    warn: "cảnh báo",
    error: "lỗi"
  };
  return labels[value] ?? value;
}

function formatAgentName(value: string) {
  const labels: Record<string, string> = {
    intent_analyzer: "Agent phân tích ý định",
    requirement_builder: "Agent xây dựng yêu cầu",
    feature_discovery: "Agent khám phá chức năng",
    architecture_planner: "Agent lập kiến trúc",
    task_decomposer: "Agent chia tác vụ",
    prompt_composer: "Agent soạn prompt",
    execution_agent: "Agent thực thi",
    review_agent: "Agent đánh giá",
    memory_context_agent: "Agent ngữ cảnh bộ nhớ",
    codebase_analyzer: "Agent phân tích mã nguồn"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function toVietnameseMessage(message: string) {
  const replacements: Array<[RegExp, string]> = [
    [/Project (.+) not found/i, "Không tìm thấy dự án $1"],
    [/Artifact (.+) not found/i, "Không tìm thấy tài liệu $1"],
    [/Artifact (.+) cannot be edited/i, "Không thể chỉnh sửa tài liệu $1"],
    [/Unknown error/i, "Lỗi chưa xác định"],
    [/Request failed/i, "Yêu cầu thất bại"],
    [/Existing project is missing sourcePath/i, "Dự án có sẵn đang thiếu sourcePath"],
    [/Cần duyệt phiên bản (artifact|tài liệu) mới nhất trước khi thực thi/i, "Cần duyệt phiên bản tài liệu mới nhất trước khi thực thi"],
    [/Source path is not a directory/i, "Đường dẫn nguồn không phải là thư mục"]
  ];
  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), message);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}
