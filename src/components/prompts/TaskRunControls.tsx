import { Circle, Loader2, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRunnerStore } from "../../store/runnerStore";
import type { Project } from "../../types/project.type";
import type { PromptTask } from "../../types/task.type";

interface TaskRunControlsProps {
  project: Project;
  task: PromptTask;
}

const runningStatuses = new Set(["preparing", "opening_terminal", "running"]);

export function TaskRunControls({ project, task }: TaskRunControlsProps) {
  const initialWorkspaceDir = useMemo(() => {
    if (project.localRunPath?.trim()) return project.localRunPath.trim();
    if (project.sourceLocation?.startsWith("/") || project.sourceLocation?.startsWith("~")) return project.sourceLocation;
    return "";
  }, [project.localRunPath, project.sourceLocation]);
  const [workspaceInput, setWorkspaceInput] = useState(initialWorkspaceDir);
  const execution = useRunnerStore((state) => state.executionsByTaskId[task.id]);
  const loading = useRunnerStore((state) => state.loading);
  const error = useRunnerStore((state) => state.error);
  const runnerOnline = useRunnerStore((state) => state.runnerOnline);
  const checkRunner = useRunnerStore((state) => state.checkRunner);
  const runTask = useRunnerStore((state) => state.runTask);
  const stopTask = useRunnerStore((state) => state.stopTask);
  const pollTask = useRunnerStore((state) => state.pollTask);
  const isRunning = execution ? runningStatuses.has(execution.status) : false;
  const workspaceDir = workspaceInput.trim();

  useEffect(() => {
    void checkRunner();
  }, [checkRunner]);

  useEffect(() => {
    setWorkspaceInput(initialWorkspaceDir);
  }, [initialWorkspaceDir]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      void pollTask(task.id);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [isRunning, pollTask, task.id]);

  async function handleRun() {
    await runTask({ ...project, localRunPath: workspaceDir }, task);
  }

  return (
    <div className="border-b border-line bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={loading || isRunning || !workspaceDir}
          className="flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && !isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Codex
        </button>
        <button
          type="button"
          onClick={() => checkRunner()}
          className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-white"
        >
          Check runner
        </button>
        <button
          type="button"
          onClick={() => stopTask(task.id)}
          disabled={!isRunning}
          className="flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Circle className={`h-2.5 w-2.5 fill-current ${runnerOnline ? "text-emerald-600" : "text-red-500"}`} />
          {runnerOnline ? "Local runner online" : "Local runner offline"}
        </span>
        <span className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
          full access
        </span>
      </div>

      <div className="mt-2 rounded-md border border-line bg-white px-3 py-2 text-xs leading-5 text-muted">
        <label className="mb-2 block text-xs font-semibold text-ink">
          Workspace path
          <input
            value={workspaceInput}
            onChange={(event) => setWorkspaceInput(event.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-xs font-normal text-ink outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
            placeholder="/Applications/du-an/ten-project"
          />
        </label>
        <p>
          <span className="font-semibold text-ink">Bước hiện tại:</span>{" "}
          {execution?.currentStep || "Chưa chạy task này"}
        </p>
        <p>
          <span className="font-semibold text-ink">Trạng thái:</span> {execution?.status || "idle"}
        </p>
        <p className="truncate">
          <span className="font-semibold text-ink">Workspace:</span>{" "}
          {workspaceDir || "Chưa có đường dẫn chạy Codex CLI trong project"}
        </p>
        {execution?.terminalCommand ? (
          <p className="truncate">
            <span className="font-semibold text-ink">Command:</span> {execution.terminalCommand}
          </p>
        ) : null}
        <p>
          <span className="font-semibold text-ink">Terminal:</span> Runner sẽ mở Terminal thật trên máy, vào đúng workspace và chạy Codex CLI đã login sẵn.
        </p>
        {error ? <p className="mt-1 text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
