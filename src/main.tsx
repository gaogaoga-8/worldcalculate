import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { restartFromLink } from "./store";

try {
  const cleanUrl = restartFromLink(window.location.href);
  if (cleanUrl) window.history.replaceState(null, "", cleanUrl);
} catch {
  window.alert("记录没有清空成功。请允许浏览器保存本机数据，再重试。");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
