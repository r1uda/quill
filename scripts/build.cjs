const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const platforms = process.argv.includes("--all")
  ? ["web", "android", "ios"]
  : ["web"];
const temp = path.join(root, "work/runtime/build-temp");
fs.mkdirSync(temp, { recursive: true });
for (const platform of platforms) {
  const output =
    platform === "web" ? "build/review-web" : `build/review-${platform}`;
  for (const directory of ["assets/assets", `_expo/static/js/${platform}`])
    fs.mkdirSync(path.join(root, output, directory), { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/expo/bin/cli"),
      "export",
      "--platform",
      platform,
      "--output-dir",
      output,
    ],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, EXPO_NO_TELEMETRY: "1", TEMP: temp, TMP: temp },
    },
  );
  if (result.error || result.status !== 0) {
    console.error(result.error || `构建失败：${platform}`);
    process.exit(1);
  }
  const html =
    platform === "web"
      ? fs.readFileSync(path.join(root, output, "index.html"), "utf8")
      : "";
  if (html) {
    for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      const target = path.join(root, output, match[1].replace(/^\//, ""));
      if (!fs.existsSync(target) || fs.statSync(target).size < 1000)
        throw new Error("网页构建文件不完整：" + target);
    }
  } else {
    const dir = path.join(root, output, `_expo/static/js/${platform}`);
    const bundles = fs.readdirSync(dir).filter((f) => f.endsWith(".hbc"));
    if (
      !bundles.length ||
      bundles.some((f) => fs.statSync(path.join(dir, f)).size < 1000000)
    )
      throw new Error("手机字节码构建文件不完整：" + platform);
  }
}
