const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
for (const args of [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  [
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    "tests/domain.test.ts",
    "tests/storage.test.ts",
    "tests/crop.test.ts",
    "tests/occasions.test.ts",
    "tests/widgets.test.ts",
    "tests/voice-gesture.test.ts",
  ],
  ["node_modules/vitest/vitest.mjs", "run"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    console.error(result.error || "检查没有通过");
    process.exit(result.status || 1);
  }
}
