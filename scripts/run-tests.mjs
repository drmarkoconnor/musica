import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

async function testFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? testFiles(file) : /\.test\.(ts|mjs)$/.test(entry.name) ? [file] : [];
  }));
  return files.flat();
}

const files = (await Promise.all([testFiles("src"), testFiles("tests")])).flat().sort();
if (files.length === 0) throw new Error("No regression tests found.");
const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "--test-concurrency=2", ...files], {
  stdio: "inherit",
  env: process.env,
});
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
