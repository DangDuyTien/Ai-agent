import { promises as fs } from "node:fs";
import path from "node:path";
import type { CodebaseContext } from "@/packages/schemas/project-blueprint.schema";

const ignoredDirectories = [
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  "out"
];

const keyFileNames = new Set([
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.ts",
  "vite.config.js",
  "nuxt.config.ts",
  "svelte.config.js",
  "app.json",
  "app.config.ts",
  "Dockerfile",
  "docker-compose.yml",
  "README.md"
]);

export async function analyzeCodebase(sourcePath: string): Promise<CodebaseContext> {
  const resolvedPath = path.resolve(sourcePath);
  const stat = await fs.stat(resolvedPath).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Đường dẫn nguồn không phải là thư mục: ${resolvedPath}`);
  }

  const files: string[] = [];
  const keyFiles: string[] = [];
  let directoryCount = 0;
  await walk(resolvedPath, "", files, keyFiles, () => {
    directoryCount += 1;
  });

  const packageJson = await readPackageJson(resolvedPath);
  const scripts = packageJson?.scripts ?? {};
  const dependencies = Object.keys(packageJson?.dependencies ?? {});
  const devDependencies = Object.keys(packageJson?.devDependencies ?? {});
  const allDeps = [...dependencies, ...devDependencies];

  return {
    sourcePath: resolvedPath,
    rootName: path.basename(resolvedPath),
    packageManager: await detectPackageManager(resolvedPath),
    frameworkSignals: detectFrameworkSignals(files, allDeps),
    languages: detectLanguages(files),
    scripts,
    dependencies,
    devDependencies,
    keyFiles,
    fileSamples: files.slice(0, 180),
    ignoredDirectories,
    stats: {
      fileCount: files.length,
      directoryCount,
      scannedAt: new Date().toISOString()
    },
    detectedCommands: detectCommands(scripts, await detectPackageManager(resolvedPath)),
    risks: detectRisks(files, scripts, packageJson)
  };
}

async function walk(root: string, relativeDir: string, files: string[], keyFiles: string[], onDirectory: () => void) {
  if (files.length > 1200) return;

  const absoluteDir = path.join(root, relativeDir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.includes(entry.name)) continue;
      onDirectory();
      await walk(root, relativePath, files, keyFiles, onDirectory);
      continue;
    }

    if (!entry.isFile()) continue;
    if (isLikelyBinary(entry.name)) continue;
    const normalized = relativePath.split(path.sep).join("/");
    files.push(normalized);
    if (keyFileNames.has(entry.name) || normalized.startsWith("app/") || normalized.startsWith("src/")) {
      if (keyFiles.length < 80) {
        keyFiles.push(normalized);
      }
    }
  }
}

async function readPackageJson(root: string) {
  try {
    const raw = await fs.readFile(path.join(root, "package.json"), "utf8");
    return JSON.parse(raw) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

async function detectPackageManager(root: string) {
  const candidates = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
    ["bun.lockb", "bun"]
  ] as const;
  for (const [file, manager] of candidates) {
    try {
      await fs.access(path.join(root, file));
      return manager;
    } catch {
      // keep checking
    }
  }
  return undefined;
}

function detectFrameworkSignals(files: string[], deps: string[]) {
  const signals = new Set<string>();
  const has = (name: string) => deps.includes(name);
  if (has("next") || files.some((file) => file.startsWith("app/") && file.endsWith("page.tsx"))) signals.add("Next.js");
  if (has("react")) signals.add("React");
  if (has("vue") || files.some((file) => file.endsWith(".vue"))) signals.add("Vue");
  if (has("svelte") || files.some((file) => file.endsWith(".svelte"))) signals.add("Svelte");
  if (has("express")) signals.add("Express");
  if (has("@nestjs/core")) signals.add("NestJS");
  if (has("expo")) signals.add("Expo");
  if (has("react-native")) signals.add("React Native");
  if (has("phaser")) signals.add("Phaser");
  if (has("electron")) signals.add("Electron");
  if (!signals.size && files.includes("package.json")) signals.add("Node.js");
  return Array.from(signals);
}

function detectLanguages(files: string[]) {
  const extensions: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".php": "PHP",
    ".rb": "Ruby",
    ".swift": "Swift",
    ".kt": "Kotlin"
  };
  const languages = new Set<string>();
  for (const file of files) {
    const language = extensions[path.extname(file)];
    if (language) languages.add(language);
  }
  return Array.from(languages);
}

function detectCommands(scripts: Record<string, string>, packageManager?: string): CodebaseContext["detectedCommands"] {
  const runner = packageManager || "npm";
  const run = runner === "npm" ? "npm run" : `${runner} run`;
  return {
    install: packageManager ? `${packageManager} install` : undefined,
    typecheck: scripts.typecheck ? `${run} typecheck` : undefined,
    test: scripts.test ? `${run} test` : undefined,
    build: scripts.build ? `${run} build` : undefined,
    dev: scripts.dev ? `${run} dev` : undefined
  };
}

function detectRisks(
  files: string[],
  scripts: Record<string, string>,
  packageJson: Awaited<ReturnType<typeof readPackageJson>>
) {
  const risks: string[] = [];
  if (!packageJson && files.some((file) => file.endsWith(".ts") || file.endsWith(".js"))) {
    risks.push("Không tìm thấy package.json nên khả năng review/test tự động bị giới hạn.");
  }
  if (packageJson && !scripts.test) {
    risks.push("Không có test script trong package.json.");
  }
  if (packageJson && !scripts.build) {
    risks.push("Không có build script trong package.json.");
  }
  if (files.length > 1000) {
    risks.push("Codebase lớn, context đã được lấy mẫu và cần bổ sung retrieval theo file khi thực thi thật.");
  }
  return risks;
}

function isLikelyBinary(fileName: string) {
  return /\.(png|jpe?g|gif|webp|ico|pdf|zip|tar|gz|mp4|mov|mp3|woff2?|ttf|eot)$/i.test(fileName);
}
