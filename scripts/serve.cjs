const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(
  __dirname,
  "..",
  process.env.QINGRI_WEB_ROOT || "build/review-web",
);
const requestedPort = Number(process.env.PORT || 8085);
if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("还没有构建预览版本，请先运行 npm run build:web。");
  process.exitCode = 1;
  return;
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
};
const server = http.createServer((req, res) => {
  let file;
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    file = path.resolve(root, "." + pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory())
    file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.setHeader(
    "Content-Type",
    mime[path.extname(file)] || "application/octet-stream",
  );
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const stream = fs.createReadStream(file);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end("Read error");
  });
  stream.pipe(res);
});
server.on("error", (err) => {
  console.error("预览启动失败：" + err.message);
  process.exitCode = 1;
});
server.listen(requestedPort, "127.0.0.1", () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}`;
  console.log(`晴日预览已启动：${url}\n关闭此窗口即可停止预览。`);
  if (process.argv.includes("--open")) {
    const args =
      process.platform === "win32" ? ["/c", "start", "", url] : [url];
    spawn(
      process.platform === "win32"
        ? "cmd"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open",
      args,
      { windowsHide: true, stdio: "ignore" },
    ).on("error", () => console.log("可在浏览器打开：" + url));
  }
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
