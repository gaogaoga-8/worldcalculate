import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BESIDE = "shijie-suanfa/star-beside";

export function starBesideDone() {
  try {
    return localStorage.getItem(BESIDE) === "1";
  } catch {
    return false;
  }
}

export function markStarBeside() {
  try {
    localStorage.setItem(BESIDE, "1");
  } catch {
    // 这台浏览器记不住，下次进来还会再轻轻说一次。
  }
  window.dispatchEvent(new Event("star-beside"));
}

export function StarClaim({
  intent,
  onClose,
  onSubmit,
  required = false,
  alternate,
}: {
  intent: "keep" | "return";
  onClose: () => void;
  onSubmit: (name: string, secret: string) => Promise<void>;
  required?: boolean;
  alternate?: { label: string; onClick: () => void };
}) {
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const title = intent === "keep" ? "留下这颗星" : "认回这颗星";
  useEffect(() => {
    ref.current?.querySelector("input")?.focus();
  }, []);
  return createPortal(
    <form
      ref={ref}
      className="intake-sheet minimal-entry claim-sheet"
      aria-label={title}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        if (!name.trim() || secret.length < 4) {
          setError(intent === "keep" ? "给这颗星一个名字和一句只有你知道的话。" : "名字和那句话都要在。");
          return;
        }
        setBusy(true);
        setError("");
        void onSubmit(name.trim(), secret)
          .then(() => onClose())
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "暂时没连上，再试一次。");
            setBusy(false);
          });
      }}
      onKeyDown={(event) => {
        if (!required && event.key === "Escape") onClose();
      }}
    >
      <header>
        <h1>{title}</h1>
        {!required && (
          <button type="button" className="surface-close" aria-label="收起" onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <input
        className="name-field"
        aria-label="用户名"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="你的名字"
        maxLength={24}
        autoComplete="username"
      />
      <input
        className="name-field claim-secret"
        aria-label="密码"
        type="password"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        placeholder="只有你知道的一句话"
        maxLength={64}
        autoComplete={intent === "keep" ? "new-password" : "current-password"}
      />
      {error && (
        <p className="minimal-error" role="alert">
          {error}
        </p>
      )}
      {alternate && (
        <button type="button" className="text-action claim-switch" onClick={alternate.onClick}>
          {alternate.label}
        </button>
      )}
      <div className="intake-save">
        <button className="entry-next" aria-label={title} disabled={busy}>
          {busy ? "…" : "✓"}
        </button>
      </div>
    </form>,
    document.body,
  );
}
