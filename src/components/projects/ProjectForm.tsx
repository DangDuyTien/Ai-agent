import { ChevronDown, FolderOpen } from "lucide-react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { runnerApi } from "../../api/runnerApi";
import type { Project, ProjectFormValues } from "../../types/project.type";
import { createProjectFolderSnapshot, createProjectFolderSnapshotFromPaths, type ProjectFolderSnapshot } from "../../utils/projectFolderSnapshot";

type FileSystemEntryLike = {
  name: string;
  fullPath?: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: FileSystemEntryLike[]) => void, error?: (error: DOMException) => void) => void;
  };
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

const MAX_DROPPED_ITEMS = 1200;

interface ProjectFormProps {
  initialProject?: Project;
  loading?: boolean;
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

const emptyValues: ProjectFormValues = {
  name: "",
  sourceType: "blank",
  sourceLocation: "",
  localRunPath: "",
  localFolderName: "",
  description: "",
  technologies: "",
  overview: "",
  folderStructure: "",
  architectureNotes: ""
};

export function ProjectForm({ initialProject, loading, onSubmit, onCancel }: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(emptyValues);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(initialProject));
  const [error, setError] = useState<string>();
  const [resolvingPath, setResolvingPath] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "true");
    folderInputRef.current?.setAttribute("directory", "true");
  }, []);

  useEffect(() => {
    if (initialProject) {
      setShowAdvanced(true);
      setValues({
        name: initialProject.name,
        sourceType: initialProject.sourceType ?? "blank",
        sourceLocation: initialProject.sourceLocation ?? "",
        localRunPath: initialProject.localRunPath ?? "",
        localFolderName: initialProject.localFolderName ?? "",
        description: initialProject.description,
        technologies: initialProject.technologies.join(", "),
        overview: initialProject.context?.overview ?? "",
        folderStructure: initialProject.context?.folderStructure ?? "",
        architectureNotes: initialProject.context?.architectureNotes ?? ""
      });
    } else {
      setShowAdvanced(false);
      setValues(emptyValues);
    }
  }, [initialProject]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("Tên project là bắt buộc.");
      return;
    }

    setError(undefined);
    await onSubmit(values);
    if (!initialProject) {
      setValues(emptyValues);
    }
  }

  function handlePickFolder() {
    folderInputRef.current?.click();
  }

  function handleFolderSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;

    applyFolderSnapshot(createProjectFolderSnapshot(files));
    event.target.value = "";
  }

  function applyFolderSnapshot(snapshot: ProjectFolderSnapshot) {
    setValues((current) => ({
      ...current,
      name: current.name.trim() || snapshot.rootName,
      sourceType: "local_path",
      sourceLocation: snapshot.sourceLabel,
      localFolderName: snapshot.localFolderName,
      technologies: current.technologies.trim() || snapshot.technologies.join(", "),
      overview: mergeText(current.overview, snapshot.overview),
      folderStructure: snapshot.folderStructure
    }));
    setShowAdvanced(true);
    setError(undefined);
    void resolveWorkspacePath(snapshot.localFolderName);
  }

  async function resolveWorkspacePath(folderName = values.localFolderName || values.name) {
    if (!folderName.trim()) {
      setError("Chưa có tên folder để tự tìm đường dẫn.");
      return;
    }

    setResolvingPath(true);
    try {
      const result = await runnerApi.resolveWorkspace({
        workspaceDir: values.localRunPath,
        folderName
      });

      if (!result.ok || !result.workspaceDir) {
        setError(`Không tự tìm thấy folder "${folderName}". Hãy chạy runner hoặc nhập path thật thủ công.`);
        return;
      }

      setValues((current) => ({
        ...current,
        localRunPath: result.workspaceDir
      }));
      setError(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không kết nối được local runner để tự tìm path.";
      setError(message);
    } finally {
      setResolvingPath(false);
    }
  }

  async function handleDropProject(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const paths = await collectDroppedPaths(event.dataTransfer.items);
    if (paths.length) {
      applyFolderSnapshot(createProjectFolderSnapshotFromPaths(paths, undefined, paths.length));
      return;
    }

    if (event.dataTransfer.files.length) {
      applyFolderSnapshot(createProjectFolderSnapshot(event.dataTransfer.files));
      return;
    }

    setError("Không đọc được folder/file được kéo thả. Hãy thử chọn thư mục bằng nút bên trên.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-line bg-white p-4 shadow-sm">
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="project-name">
          Tên project hoặc thư mục dự án
        </label>
        <input
          id="project-name"
          value={values.name}
          onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
          placeholder="Ví dụ: Shop App, Admin CRM, PromptFlow Agent"
        />
        <p className="mt-2 text-xs leading-5 text-muted">
          Chỉ cần tên project là đủ để bắt đầu. Mô tả, công nghệ, context và cấu trúc thư mục đều là tuỳ chọn.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <label className="text-sm font-medium text-ink">
          Loại project
          <select
            value={values.sourceType}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                sourceType: event.target.value as ProjectFormValues["sourceType"]
              }))
            }
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
          >
            <option value="blank">Chỉ lập kế hoạch</option>
            <option value="local_path">Project có sẵn trên máy</option>
            <option value="git_repository">Project có sẵn trên Git</option>
          </select>
        </label>

        <div className="text-sm font-medium text-ink">
          Nguồn project
          {values.sourceType === "local_path" ? (
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handlePickFolder}
                className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100"
              >
                <FolderOpen className="h-4 w-4" />
                Chọn thư mục
              </button>
              <input
                value={values.sourceLocation}
                readOnly
                className="min-w-0 flex-1 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-muted outline-none"
                placeholder="Chưa chọn thư mục"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFolderSelected}
              />
            </div>
          ) : (
            <input
              value={values.sourceLocation}
              onChange={(event) => setValues((current) => ({ ...current, sourceLocation: event.target.value }))}
              disabled={values.sourceType === "blank"}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="https://github.com/team/shop-app"
            />
          )}
          <span className="mt-1 block text-xs leading-5 text-muted">
            Không chọn thư mục hệ thống như Applications/Macintosh HD. Hãy chọn đúng folder project, hoặc kéo thả folder vào ô bên dưới.
          </span>
          {values.sourceType === "local_path" ? (
            <>
              <label className="mt-2 block text-sm font-medium text-ink">
                Đường dẫn chạy Codex CLI
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={values.localRunPath}
                    onChange={(event) => setValues((current) => ({ ...current, localRunPath: event.target.value }))}
                    className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                    placeholder="/Applications/du-an/ten-project"
                  />
                  <button
                    type="button"
                    onClick={() => resolveWorkspacePath()}
                    disabled={resolvingPath}
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resolvingPath ? "Đang tìm..." : "Tự tìm path"}
                  </button>
                </div>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  App sẽ hỏi local runner để tìm folder theo tên đã chọn. Nếu runner chưa chạy, bật `npm run runner`.
                </span>
              </label>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDropProject}
                className="mt-2 rounded-md border border-dashed border-line bg-white px-3 py-3 text-center text-xs leading-5 text-muted"
              >
                Kéo thả folder project vào đây. App sẽ bỏ qua `.git`, `node_modules`, `dist`, `build` khi tạo context.
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border border-line bg-slate-50">
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-ink"
        >
          Thông tin nâng cao không bắt buộc
          <ChevronDown className={`h-4 w-4 text-muted transition ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced ? (
          <div className="space-y-4 border-t border-line p-3">
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="project-description">
                Mô tả
              </label>
              <textarea
                id="project-description"
                value={values.description}
                onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
                className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                placeholder="Có thể để trống, AI sẽ suy luận từ yêu cầu sau."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink" htmlFor="project-tech">
                Công nghệ sử dụng
              </label>
              <input
                id="project-tech"
                value={values.technologies}
                onChange={(event) => setValues((current) => ({ ...current, technologies: event.target.value }))}
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                placeholder="React, TypeScript, Laravel, MySQL"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink" htmlFor="project-context">
                Context dự án
              </label>
              <textarea
                id="project-context"
                value={values.overview}
                onChange={(event) => setValues((current) => ({ ...current, overview: event.target.value }))}
                className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                placeholder="Chỉ nhập nếu có ràng buộc đặc biệt cần AI biết."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink" htmlFor="project-folder">
                Cấu trúc thư mục
              </label>
              <textarea
                id="project-folder"
                value={values.folderStructure}
                onChange={(event) => setValues((current) => ({ ...current, folderStructure: event.target.value }))}
                className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                placeholder={"src/\n  api/\n  components/\n  pages/"}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink" htmlFor="project-notes">
                Ghi chú kiến trúc
              </label>
              <textarea
                id="project-notes"
                value={values.architectureNotes}
                onChange={(event) => setValues((current) => ({ ...current, architectureNotes: event.target.value }))}
                className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                placeholder="Quy ước code, pattern, ràng buộc bảo mật, test..."
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-slate-100"
          >
            Huỷ
          </button>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {initialProject ? "Lưu project" : "Tạo project"}
        </button>
      </div>
    </form>
  );
}

async function collectDroppedPaths(items: DataTransferItemList): Promise<string[]> {
  const paths: string[] = [];
  const entries: FileSystemEntryLike[] = [];

  Array.from(items).forEach((item) => {
    const entry = (item as unknown as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null;
    if (entry) {
      entries.push(entry);
    }
  });

  for (const entry of entries) {
    if (paths.length >= MAX_DROPPED_ITEMS) break;
    await walkEntry(entry, trimLeadingSlash(entry.fullPath || entry.name), paths);
  }

  return paths;
}

async function walkEntry(entry: FileSystemEntryLike, currentPath: string, paths: string[]): Promise<void> {
  if (paths.length >= MAX_DROPPED_ITEMS || shouldIgnoreSegment(entry.name)) return;

  if (entry.isFile) {
    paths.push(currentPath);
    return;
  }

  if (!entry.isDirectory || !entry.createReader) return;

  const reader = entry.createReader();
  const children = await readAllDirectoryEntries(reader);
  for (const child of children) {
    if (paths.length >= MAX_DROPPED_ITEMS) break;
    await walkEntry(child, `${currentPath}/${child.name}`, paths);
  }
}

async function readAllDirectoryEntries(reader: ReturnType<NonNullable<FileSystemEntryLike["createReader"]>>): Promise<FileSystemEntryLike[]> {
  const entries: FileSystemEntryLike[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    if (!batch.length) break;
    entries.push(...batch);
  }

  return entries;
}

function shouldIgnoreSegment(segment: string): boolean {
  return ["node_modules", ".git", "dist", "build", ".next", ".nuxt", "vendor", "coverage"].includes(segment);
}

function trimLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

function mergeText(current: string, next: string): string {
  if (!current.trim()) return next;
  if (current.includes(next)) return current;
  return `${current.trim()}\n\n${next}`;
}
