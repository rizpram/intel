import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  throw new Error("Next.js standalone output is missing. Run this script after `next build`.");
}

mkdirSync(join(standalone, ".next"), { recursive: true });

for (const [source, destination] of [
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
  [join(root, "public"), join(standalone, "public")],
]) {
  if (existsSync(source)) cpSync(source, destination, { recursive: true, force: true });
}
