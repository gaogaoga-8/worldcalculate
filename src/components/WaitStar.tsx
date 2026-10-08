import { useEffect, useState } from "react";

const LINES = [
  "盘已经在，这句话还在路上。",
  "先不急着给它一个名字。",
  "同一颗星，换一个角度看。",
  "你刚说的那句，先停在这里。",
];

const LINE_AFTER_MS = 2000;
const CHAT_STEP_MS = 4000;
const ASK_STEP_MS = 8000;

export function WaitStar({ pace }: { pace: "chat" | "ask" }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => {
      setElapsed(performance.now() - started);
    }, 200);
    return () => window.clearInterval(timer);
  }, []);

  const showLine = elapsed >= LINE_AFTER_MS;
  const step = pace === "chat" ? CHAT_STEP_MS : ASK_STEP_MS;
  const index = showLine ? Math.floor((elapsed - LINE_AFTER_MS) / step) % LINES.length : 0;

  return (
    <div className={`wait-star ${elapsed > 1100 ? "drift" : ""}`} role="status" aria-live="polite">
      <i />
      {showLine ? <span key={`${pace}-${index}`}>{LINES[index]}</span> : null}
    </div>
  );
}
