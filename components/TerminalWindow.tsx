"use client";

import { Bot, Clock3, TerminalSquare, UserRound } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type TerminalLog = {
  id: string;
  level: string;
  message: string;
  createdAt?: string;
  agentRunId?: string;
  metadata?: Record<string, unknown>;
};

type TerminalRun = {
  id: string;
  agentName: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
};

export function TerminalWindow({
  logs,
  runs = [],
  isRunning
}: {
  logs: TerminalLog[];
  runs?: TerminalRun[];
  isRunning: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, isRunning]);

  useEffect(() => {
    if (!isRunning && !runs.some((run) => run.status === "running")) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, runs]);

  const runningRuns = runs.filter((run) => run.status === "running");
  const firstActivity = useMemo(() => {
    const logTime = logs[0]?.createdAt ? Date.parse(logs[0].createdAt) : undefined;
    const runTime = runs[0]?.startedAt ? Date.parse(runs[0].startedAt) : undefined;
    return [logTime, runTime].filter((value): value is number => Number.isFinite(value)).sort((a, b) => a - b)[0];
  }, [logs, runs]);
  const totalElapsed = firstActivity ? formatElapsed(now - firstActivity) : "0s";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.windowControls}>
          <span style={{ ...styles.dot, backgroundColor: "#ff5f56" }} />
          <span style={{ ...styles.dot, backgroundColor: "#ffbd2e" }} />
          <span style={{ ...styles.dot, backgroundColor: "#27c93f" }} />
        </div>
        <div style={styles.headerTitle}>
          <TerminalSquare size={14} />
          <span>AI Agent Chat Terminal</span>
        </div>
        <div style={styles.timer}>
          <Clock3 size={13} />
          <span>{runningRuns.length ? `đang chạy ${formatElapsed(now - Date.parse(runningRuns[0].startedAt))}` : totalElapsed}</span>
        </div>
      </div>

      <div style={styles.statusBar}>
        <span>{logs.length} dòng log</span>
        <span>{runningRuns.length ? `${runningRuns.length} agent đang chạy` : "không có agent đang chạy"}</span>
        <span>tổng {totalElapsed}</span>
      </div>

      <div style={styles.body}>
        {logs.map((log, index) => {
          const previous = index > 0 ? logs[index - 1] : undefined;
          return <LogMessage key={log.id} log={log} previousLog={previous} />;
        })}

        {runningRuns.map((run) => (
          <div key={run.id} style={styles.runningLine}>
            <span style={styles.cursor}>█</span>
            <span>{formatAgentName(run.agentName)} đang xử lý {formatElapsed(now - Date.parse(run.startedAt))}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <style>{`
        @keyframes terminalBlink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function LogMessage({ log, previousLog }: { log: TerminalLog; previousLog?: TerminalLog }) {
  const kind = typeof log.metadata?.kind === "string" ? log.metadata.kind : "system";
  const role = roleForKind(kind, log.level);
  const detail = detailForLog(log);
  const createdAt = log.createdAt ? Date.parse(log.createdAt) : undefined;
  const previousAt = previousLog?.createdAt ? Date.parse(previousLog.createdAt) : undefined;
  const delta = createdAt && previousAt ? `+${formatElapsed(createdAt - previousAt)}` : "";

  return (
    <article style={{ ...styles.message, alignSelf: role.align }}>
      <div style={styles.messageMeta}>
        <span style={{ ...styles.roleBadge, color: role.color }}>
          {role.icon}
          {role.label}
        </span>
        <span>{log.createdAt ? formatTime(log.createdAt) : "--:--:--"}</span>
        {delta ? <span>{delta}</span> : null}
      </div>
      <div style={{ ...styles.bubble, borderColor: role.borderColor, backgroundColor: role.backgroundColor }}>
        <div style={{ ...styles.messageText, color: log.level === "error" ? "#ff8d85" : log.level === "warn" ? "#ffd36b" : "#e7e7e7" }}>
          {log.message}
        </div>
        {detail ? <pre style={styles.detail}>{detail}</pre> : null}
      </div>
    </article>
  );
}

function detailForLog(log: TerminalLog) {
  const kind = typeof log.metadata?.kind === "string" ? log.metadata.kind : "";
  if (kind === "agent_input" && "input" in (log.metadata ?? {})) return stringifyDetail(log.metadata?.input);
  if ((kind === "agent_output" || kind === "provider_output") && "output" in (log.metadata ?? {})) return stringifyDetail(log.metadata?.output);
  if (kind === "provider_fallback" || kind === "agent_error") return stringifyDetail(log.metadata);
  return "";
}

function stringifyDetail(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2);
  return text.length > 14000 ? `${text.slice(0, 14000)}\n...[đã cắt bớt]` : text;
}

function roleForKind(kind: string, level: string) {
  if (kind === "agent_input") {
    return {
      label: "Yêu cầu",
      icon: <UserRound size={13} />,
      color: "#9ddcff",
      borderColor: "#22556d",
      backgroundColor: "#13242d",
      align: "flex-start" as const
    };
  }
  if (kind === "agent_output" || kind === "provider_output") {
    return {
      label: "AI",
      icon: <Bot size={13} />,
      color: "#7ee0b1",
      borderColor: "#25634a",
      backgroundColor: "#10261d",
      align: "flex-end" as const
    };
  }
  return {
    label: level === "error" ? "Lỗi" : level === "warn" ? "Cảnh báo" : "Hệ thống",
    icon: <TerminalSquare size={13} />,
    color: level === "error" ? "#ff8d85" : level === "warn" ? "#ffd36b" : "#cfcfcf",
    borderColor: level === "error" ? "#72312d" : level === "warn" ? "#705321" : "#3a3a3a",
    backgroundColor: level === "error" ? "#2b1716" : level === "warn" ? "#2b2413" : "#202020",
    align: "stretch" as const
  };
}

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatElapsed(ms: number) {
  const safeMs = Math.max(0, ms);
  if (safeMs < 1000) return `${safeMs}ms`;
  const seconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 1) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 1) return `${minutes}m ${restSeconds}s`;
  return `${hours}h ${restMinutes}m ${restSeconds}s`;
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
    memory_context_agent: "Agent bộ nhớ",
    codebase_analyzer: "Agent phân tích codebase"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

const styles: Record<string, CSSProperties> = {
  container: {
    backgroundColor: "#171717",
    borderRadius: "8px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    height: "640px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    border: "1px solid #303030"
  },
  header: {
    backgroundColor: "#262626",
    padding: "8px 12px",
    display: "grid",
    gridTemplateColumns: "100px 1fr 160px",
    alignItems: "center",
    borderBottom: "1px solid #111",
    gap: "8px"
  },
  windowControls: {
    display: "flex",
    gap: "8px"
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%"
  },
  headerTitle: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    color: "#cfcfcf",
    fontSize: "12px",
    fontWeight: 700
  },
  timer: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "6px",
    color: "#a7d7ff",
    fontSize: "12px"
  },
  statusBar: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    padding: "8px 14px",
    backgroundColor: "#1f1f1f",
    color: "#9a9a9a",
    fontSize: "12px",
    borderBottom: "1px solid #303030"
  },
  body: {
    flex: 1,
    padding: "16px",
    overflowY: "auto",
    backgroundColor: "#171717",
    color: "#d4d4d4",
    fontSize: "13px",
    lineHeight: "1.5",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  message: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "100%",
    gap: "4px"
  },
  messageMeta: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    color: "#8b8b8b",
    fontSize: "11px"
  },
  roleBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontWeight: 700
  },
  bubble: {
    border: "1px solid",
    borderRadius: "8px",
    padding: "10px 12px",
    maxWidth: "100%"
  },
  messageText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  },
  detail: {
    margin: "10px 0 0",
    padding: "10px",
    borderRadius: "6px",
    backgroundColor: "#101010",
    border: "1px solid #2d2d2d",
    color: "#cfcfcf",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "320px"
  },
  runningLine: {
    display: "flex",
    gap: "10px",
    color: "#7ee0b1",
    alignItems: "center"
  },
  cursor: {
    animation: "terminalBlink 1s step-end infinite"
  }
};
