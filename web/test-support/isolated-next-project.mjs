import fs from "node:fs";
import path from "node:path";

export function createIsolatedNextProject(sourceDir, tempDir) {
  const projectDir = path.join(tempDir, "web");
  fs.mkdirSync(projectDir, { recursive: true });
  for (const entry of ["src", "public", "package.json", "next.config.mjs", "postcss.config.mjs", "tsconfig.json", "next-env.d.ts"]) {
    const source = path.join(sourceDir, entry);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(projectDir, entry), { recursive: true });
  }
  const configPath = path.join(projectDir, "next.config.mjs");
  const config = fs.readFileSync(configPath, "utf8").replace("root: import.meta.dirname", `root: ${JSON.stringify(sourceDir)}`);
  fs.writeFileSync(configPath, config);
  return projectDir;
}
