"use client";

import { TerminalSquare } from "lucide-react";
import { useEffect, useRef } from "react";

export function TerminalWindow({ logs, isRunning }: { logs: Array<{ id: string, level: string, message: string }>, isRunning: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, isRunning]);

  return (
    <div className="terminal-container" style={{
      backgroundColor: "#1e1e1e",
      borderRadius: "8px",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      height: "600px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      border: "1px solid #333"
    }}>
      <div className="terminal-header" style={{
        backgroundColor: "#2d2d2d",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #000"
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ff5f56" }}></div>
          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ffbd2e" }}></div>
          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#27c93f" }}></div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", color: "#999", fontSize: "12px", fontWeight: "bold" }}>
          <TerminalSquare size={14} /> AI Agent Terminal
        </div>
      </div>
      <div className="terminal-body" style={{
        flex: 1,
        padding: "16px",
        overflowY: "auto",
        backgroundColor: "#1e1e1e",
        color: "#d4d4d4",
        fontSize: "13px",
        lineHeight: "1.5"
      }}>
        {logs.map((log) => (
          <div key={log.id} style={{ display: "flex", gap: "10px", marginBottom: "4px", color: log.level === "error" ? "#ff5f56" : log.level === "warn" ? "#ffbd2e" : "#d4d4d4" }}>
            <span style={{ color: "#27c93f", userSelect: "none" }}>$</span>
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{log.message}</span>
          </div>
        ))}
        {isRunning && (
          <div style={{ display: "flex", gap: "10px", marginTop: "8px", color: "#27c93f" }}>
            <span>$</span>
            <span style={{ animation: "blink 1s step-end infinite" }}>█</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
