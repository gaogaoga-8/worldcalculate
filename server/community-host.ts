import http from "node:http";
import { createCommunity } from "./community";

const port = Number(process.env.PORT || 4174);
const service = createCommunity(process.env.COMMUNITY_DB);
const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://local");
  const prefix = "/api/community";
  if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
    url.pathname = url.pathname.slice(prefix.length) || "/";
    req.url = `${url.pathname}${url.search}`;
  }
  void service.handle(req, res);
});

server.listen(port, "127.0.0.1");
