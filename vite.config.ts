import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { oraclePlugin } from "./server/oraclePlugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.CURSOR_API_KEY) process.env.CURSOR_API_KEY = env.CURSOR_API_KEY;
  return {
    base: mode === "production" ? "./" : "/",
    plugins: [react(), oraclePlugin()],
    server: { host: "127.0.0.1", port: 5173 },
  };
});
