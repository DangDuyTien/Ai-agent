type LocalFileWithPath = File & {
  webkitRelativePath: string;
};

export interface ProjectFolderSnapshot {
  rootName: string;
  fileCount: number;
  localFolderName: string;
  folderStructure: string;
  technologies: string[];
  sourceLabel: string;
  overview: string;
}

const IGNORED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "vendor",
  "coverage",
  ".turbo",
  ".vite"
]);

const MAX_FILES_IN_TREE = 180;
const MAX_DEPTH = 4;

export function createProjectFolderSnapshot(fileList: FileList | File[]): ProjectFolderSnapshot {
  const files = Array.from(fileList) as LocalFileWithPath[];
  const paths = files.map((file) => file.webkitRelativePath || file.name).filter(Boolean);
  return createProjectFolderSnapshotFromPaths(paths, undefined, files.length);
}

export function createProjectFolderSnapshotFromPaths(
  paths: string[],
  rootNameOverride?: string,
  totalFileCount = paths.length
): ProjectFolderSnapshot {
  const cleanPaths = paths.filter((path) => !path.split("/").some((segment) => IGNORED_SEGMENTS.has(segment)));
  const rootName = rootNameOverride || getRootName(cleanPaths) || "selected-project";
  const technologies = inferTechnologies(cleanPaths);
  const folderStructure = renderFolderTree(cleanPaths, rootName);

  return {
    rootName,
    fileCount: totalFileCount,
    localFolderName: rootName,
    folderStructure,
    technologies,
    sourceLabel: `Selected folder: ${rootName} (${totalFileCount} files)`,
    overview: [
      `User selected local folder "${rootName}" from browser file picker.`,
      `Browser security does not expose the absolute local path, but ${totalFileCount} files were granted for context snapshot.`,
      "Use the captured folder structure and inferred technologies when analyzing future feature/change requests."
    ].join("\n")
  };
}

function getRootName(paths: string[]): string {
  const firstPath = paths[0];
  if (!firstPath) return "";
  return firstPath.split("/")[0] || firstPath;
}

function inferTechnologies(paths: string[]): string[] {
  const joined = paths.join("\n").toLowerCase();
  const technologies = new Set<string>();

  if (joined.includes("package.json")) technologies.add("Node.js");
  if (joined.includes("vite.config") || joined.includes("src/main.tsx") || joined.includes("src/app.tsx")) technologies.add("React");
  if (joined.includes("next.config")) technologies.add("Next.js");
  if (joined.includes("tailwind.config")) technologies.add("Tailwind CSS");
  if (joined.includes("tsconfig.json") || joined.endsWith(".ts") || joined.includes(".tsx")) technologies.add("TypeScript");
  if (joined.includes("composer.json") || joined.includes("artisan")) technologies.add("PHP");
  if (joined.includes("app/http/controllers") || joined.includes("routes/web.php") || joined.includes("routes/api.php")) {
    technologies.add("Laravel");
  }
  if (joined.includes("requirements.txt") || joined.includes("manage.py")) technologies.add("Python");
  if (joined.includes("pubspec.yaml")) technologies.add("Flutter");
  if (joined.includes("dockerfile") || joined.includes("docker-compose")) technologies.add("Docker");
  if (joined.includes("prisma/schema.prisma")) technologies.add("Prisma");

  return technologies.size ? Array.from(technologies) : ["Chưa xác định"];
}

function renderFolderTree(paths: string[], rootName: string): string {
  const tree = new Map<string, Set<string>>();

  paths.slice(0, MAX_FILES_IN_TREE).forEach((path) => {
    const segments = path.split("/").filter(Boolean);
    if (!segments.length) return;

    const limited = segments.slice(0, MAX_DEPTH + 1);
    limited.forEach((segment, index) => {
      if (IGNORED_SEGMENTS.has(segment)) return;
      const parent = limited.slice(0, index).join("/") || "__root__";
      if (!tree.has(parent)) tree.set(parent, new Set());
      tree.get(parent)?.add(segment);
    });
  });

  const lines = [rootName];
  appendChildren(tree, "__root__", lines, 1, rootName);

  if (paths.length > MAX_FILES_IN_TREE) {
    lines.push(`... (${paths.length - MAX_FILES_IN_TREE} files hidden)`);
  }

  return lines.join("\n");
}

function appendChildren(tree: Map<string, Set<string>>, parent: string, lines: string[], depth: number, rootName: string): void {
  if (depth > MAX_DEPTH + 1) return;

  const children = Array.from(tree.get(parent) ?? []).sort((a, b) => a.localeCompare(b));
  children.forEach((child) => {
    if (parent === "__root__" && child === rootName) {
      appendChildren(tree, child, lines, depth, rootName);
      return;
    }

    lines.push(`${"  ".repeat(depth - 1)}- ${child}`);
    const nextParent = parent === "__root__" ? child : `${parent}/${child}`;
    appendChildren(tree, nextParent, lines, depth + 1, rootName);
  });
}
