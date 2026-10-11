import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { createCommunity } from "./community";
import { createOracleHandler } from "./oraclePlugin";

const root = resolve("dist");
if (!existsSync(resolve(root, "index.html")))
  throw new Error("Run npm run build before npm start.");
const service = createCommunity();
const oracle = createOracleHandler();
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};
const server = createServer((req, res) => {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "same-origin");
  const url = new URL(req.url || "/", "http://local");
  if (url.pathname.startsWith("/api/community/")) {
    req.url = req.url!.slice("/api/community".length);
    void service.handle(req, res);
    return;
  }
  if (url.pathname === "/api/oracle") {
    void oracle(req, res);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    res.statusCode = 404;
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end();
    return;
  }
  let requested: string;
  try {
    requested = resolve(root, "." + decodeURIComponent(url.pathname));
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }
  if (requested !== root && !requested.startsWith(root + sep)) {
    res.statusCode = 403;
    res.end();
    return;
  }
  const file =
    existsSync(requested) && statSync(requested).isFile()
      ? requested
      : resolve(root, "index.html");
  res.setHeader(
    "content-type",
    types[extname(file)] || "application/octet-stream",
  );
  res.setHeader(
    "cache-control",
    file.includes(`${sep}assets${sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  );
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file)
    .on("error", () => {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    })
    .pipe(res);
});
server.listen(
  Number(process.env.PORT || 5175),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Worldcalculate listening on port ${(server.address() as { port: number }).port}`,
    ),
);
const stop = () =>
  server.close(() => {
    service.close();
    process.exit(0);
  });
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
