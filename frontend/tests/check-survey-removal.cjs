/* eslint-disable @typescript-eslint/no-require-imports */
/** Mechanical removal rehearsal in a fresh temporary copy. Never edits source. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ody-survey-removal-369-"));
const excluded = ["src/components/survey", "src/hooks/survey", "src/stores/use-survey-store.ts",
  "src/constants/survey.ts", "src/types/survey.ts", "src/lib/anonymous-id.ts", "src/app/bff/feedback"];
function copy(relative) {
  if (excluded.some((entry) => relative === entry || relative.startsWith(`${entry}/`))) return;
  const from = path.join(root, relative), to = path.join(scratch, relative);
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) copy(`${relative}/${entry}`);
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (/\.(ts|tsx|json)$/.test(relative)) {
      const text = fs.readFileSync(from, "utf8").split(/\r?\n/).filter((line) => !line.includes("REMOVE-WITH-SURVEY")).join("\n");
      fs.writeFileSync(to, text);
    } else fs.copyFileSync(from, to);
  }
}
for (const entry of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs",
  "tests/register.cjs", "tests/playback.test.cjs"]) copy(entry);
// Both the temporary app and linked dependencies must be inside the tracing
// root; otherwise standalone's relative copy path escapes its output on Windows.
const configPath = path.join(scratch, "next.config.ts");
fs.writeFileSync(configPath, fs.readFileSync(configPath, "utf8").replace('output: "standalone",',
  `output: "standalone", outputFileTracingRoot: ${JSON.stringify(path.parse(root).root)},`));
fs.symlinkSync(path.join(root, "node_modules"), path.join(scratch, "node_modules"), "junction");
console.log(`Removal rehearsal: ${scratch}`);
const env = { ...process.env, NEXT_PUBLIC_TEST_TOOLS: "0", USE_MOCK_API: "1", NEXT_TELEMETRY_DISABLED: "1" };
// webpack supports dependencies linked from the original checkout on Windows.
for (const args of [[path.join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
  ["--require", "./tests/register.cjs", "--test", "tests/playback.test.cjs"]]) {
  const result = spawnSync(process.execPath, args, { cwd: scratch, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Survey folders removed: build, types and core playback tests passed.");
console.log("Temporary copy retained for inspection; original working tree was not modified.");
