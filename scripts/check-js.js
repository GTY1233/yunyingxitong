const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const includeDirs = ["."];
const skipDirs = new Set([".git", "data", "node_modules", "dist", "build", "docs", "scripts"]);
const files = [];

function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) collect(path.join(dir, entry.name));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.join(dir, entry.name));
    }
  }
}

for (const dir of includeDirs) {
  const fullPath = path.join(root, dir);
  if (fs.existsSync(fullPath)) collect(fullPath);
}

files.sort();

for (const file of files) {
  const relative = path.relative(root, file);
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`Syntax check failed: ${relative}`);
    process.exit(result.status || 1);
  }
}

console.log(`Checked ${files.length} JavaScript files.`);
