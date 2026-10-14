import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export function Arrival({
  name,
  onEnter,
}: {
  name: string;
  onEnter: (destination: "self" | "connect") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = document.getElementById("root");
    const was = root?.inert || false;
    const previous = document.activeElement as HTMLElement | null;
    if (root) root.inert = true;
    ref.current?.querySelector("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const controls = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
          ) || [],
        );
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls.at(-1)
        ) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      if (root) root.inert = was;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  async function enter(destination: "self" | "connect") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onEnter(destination);
    } catch {
      setError("暂时没连上，再试一次。");
      setBusy(false);
    }
  }
  return createPortal(
    <div className="arrival-overlay guest-arrival">
      <section
        ref={ref}
        className="arrival-card"
        role="dialog"
        aria-modal="true"
        aria-label="访客入场"
      >
        <p className="arrival-greeting">你好，{name}</p>
        <button
          className="arrival-enter entry-next"
          aria-label="进入我的星系"
          onClick={() => void enter("self")}
          disabled={busy}
        >
          {busy ? "…" : "→"}
        </button>
        <button
          className="arrival-wander text-action"
          onClick={() => void enter("connect")}
          disabled={busy}
        >
          去远方看看
        </button>
        <p className="quiet-hint">以访客身份进入</p>
        {error && (
          <p role="alert" className="minimal-error">
            {error}
          </p>
        )}
      </section>
    </div>,
    document.body,
  );
}
