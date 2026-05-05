import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { apiError, apiOk } from "@/lib/api";

export const runtime = "nodejs";

const ignoredPathSegments = new Set([
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out"
]);

const defaultMaxFiles = 2000;
const defaultMaxBytes = 50 * 1024 * 1024;
const defaultMaxSingleFileBytes = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadRoot = await createUploadRoot();
    const maxFiles = readPositiveInteger(process.env.AI_AGENT_UPLOAD_MAX_FILES, defaultMaxFiles);
    const maxBytes = readPositiveInteger(process.env.AI_AGENT_UPLOAD_MAX_BYTES, defaultMaxBytes);
    const maxSingleFileBytes = readPositiveInteger(
      process.env.AI_AGENT_UPLOAD_MAX_SINGLE_FILE_BYTES,
      defaultMaxSingleFileBytes
    );
    const uploadFiles = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => ({
        file,
        originalName: file.name,
        relativePath: sanitizeRelativePath(file.name)
      }));
    const commonRoot = findCommonRootSegment(uploadFiles.map((entry) => entry.relativePath).filter(Boolean));
    let storedFiles = 0;
    let storedBytes = 0;
    const skippedFiles: string[] = [];

    for (const entry of uploadFiles) {
      const relativePath = stripCommonRoot(entry.relativePath, commonRoot);
      if (!relativePath) {
        skippedFiles.push(entry.originalName || "unknown");
        continue;
      }

      if (storedFiles >= maxFiles) {
        skippedFiles.push(`${relativePath} (vượt giới hạn ${maxFiles} file)`);
        continue;
      }

      if (entry.file.size > maxSingleFileBytes) {
        skippedFiles.push(`${relativePath} (file lớn hơn ${formatBytes(maxSingleFileBytes)})`);
        continue;
      }

      if (storedBytes + entry.file.size > maxBytes) {
        skippedFiles.push(`${relativePath} (vượt tổng dung lượng ${formatBytes(maxBytes)})`);
        continue;
      }

      const targetPath = path.join(uploadRoot, relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, Buffer.from(await entry.file.arrayBuffer()));
      storedFiles += 1;
      storedBytes += entry.file.size;
    }

    if (storedFiles === 0) {
      throw new Error("Không có file hợp lệ để upload. Hãy chọn thư mục dự án có mã nguồn.");
    }

    return apiOk({
      sourcePath: uploadRoot,
      fileCount: storedFiles,
      skippedFiles: skippedFiles.slice(0, 80),
      skippedCount: skippedFiles.length,
      totalBytes: storedBytes
    });
  } catch (error) {
    return apiError(error, 400);
  }
}

async function createUploadRoot() {
  const uploadsRoot = process.env.AI_AGENT_WORKSPACE_ROOT
    ? path.join(path.resolve(process.env.AI_AGENT_WORKSPACE_ROOT), "uploads")
    : path.join(process.cwd(), "workspaces", "uploads");
  const uploadRoot = path.join(uploadsRoot, `${Date.now()}-${randomUUID()}`);
  await fs.mkdir(uploadRoot, { recursive: true });
  return uploadRoot;
}

function sanitizeRelativePath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  if (segments.some((segment) => segment === "." || segment === ".." || ignoredPathSegments.has(segment))) return "";
  return segments.join("/");
}

function findCommonRootSegment(relativePaths: string[]) {
  if (relativePaths.length === 0) return "";
  const firstPathSegments = relativePaths[0].split("/");
  if (firstPathSegments.length < 2) return "";
  const [firstSegment] = firstPathSegments;
  return relativePaths.every((relativePath) => {
    const segments = relativePath.split("/");
    return segments.length >= 2 && segments[0] === firstSegment;
  })
    ? firstSegment
    : "";
}

function stripCommonRoot(relativePath: string, commonRoot: string) {
  if (!commonRoot) return relativePath;
  const prefix = `${commonRoot}/`;
  return relativePath.startsWith(prefix) ? relativePath.slice(prefix.length) : relativePath;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)}MB`;
  if (value >= 1024) return `${Math.round(value / 1024)}KB`;
  return `${value}B`;
}
