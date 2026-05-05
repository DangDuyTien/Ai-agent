import { rm } from "node:fs/promises";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");

await rm(nextDir, { recursive: true, force: true });
console.log(`Removed ${nextDir}`);

