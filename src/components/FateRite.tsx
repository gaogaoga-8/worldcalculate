import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Chart } from "../bazi/chart";
import { askOracle } from "../oracle/client";
import { fateMessages, plainReading } from "../oracle/prompt";
import { updateState } from "../store";

const LINES = [
  "你有一次向命运发问的机会",
  "聆听天命，须知事在人为",
  "凡人，勿沉湎",
];

const AGAIN = "你可以再向命运发问一次";

type Stage = "gather" | "oracle" | "ask" | "vanish" | "read" | "burn";

export function FateRite({
  chart,
  again = false,
  onClose,
}: {
  chart: Chart;
  again?: boolean;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("gather");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState("");
  const [gone, setGone] = useState(false);
  const [fault, setFault] = useState("");
  const spent = useRef(false);

  useEffect(() => {
    if (!pending || !gone) return;
    setAnswer(pending);
    setStage("read");
  }, [pending, gone]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || stage !== "ask") return;
    setFault("");
    setGone(false);
    setPending("");
    setStage("vanish");
    try {
      const reading = plainReading(await askOracle(fateMessages(chart, text)));
      if (!spent.current) {
        spent.current = true;
        updateState((prev) => ({
          ...prev,
          fateUses: prev.fateUses + 1,
          fateAsked: true,
        }));
      }
      setPending(reading);
    } catch (error) {
      setFault(error instanceof Error ? error.message : "这一问没有落下。");
      setStage("ask");
    }
  }

  return (
    <div className={`fate-rite${stage === "gather" ? " is-clear" : ""}`} role="dialog" aria-modal="true" aria-label="向命运发问">
      {stage === "gather" && <SkyGather onDone={() => setStage("oracle")} />}
      {stage === "oracle" && <OracleLines again={again} onDone={() => setStage("ask")} />}
      {stage === "ask" && (
        <form className="fate-ask" onSubmit={submit}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="你想问什么"
            aria-label="向命运发问"
            maxLength={200}
            autoFocus
          />
          <button type="submit" aria-label="发问" disabled={!question.trim()}>↑</button>
          {fault && <p className="fate-fault">{fault}</p>}
          <button type="button" className="fate-leave" onClick={onClose}>先不问</button>
        </form>
      )}
      {stage === "vanish" && (
        <p className="fate-question" onAnimationEnd={() => setGone(true)}>{question}</p>
      )}
      {stage === "read" && (
        <div className="fate-sheet">
          <div className="fate-read">
            {readingParagraphs(answer).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <button type="button" className="fate-star" aria-label="退出" onClick={() => setStage("burn")}>✦</button>
        </div>
      )}
      {stage === "burn" && <BurnReading text={answer} onDone={onClose} />}
    </div>
  );
}

function readingParagraphs(text: string): string[] {
  const cleaned = text.replace(/\r/g, "").trim();
  const broken = cleaned.split(/\n\s*\n/).map((part) => part.replace(/\n/g, "").trim()).filter(Boolean);
  if (broken.length > 1) return broken;
  const sentences = cleaned.split(/(?<=[。！？])/u).map((part) => part.trim()).filter(Boolean);
  if (sentences.length <= 2) return [cleaned];
  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) groups.push(sentences.slice(i, i + 2).join(""));
  return groups;
}

function OracleLines({ again, onDone }: { again: boolean; onDone: () => void }) {
  const lines = again ? [AGAIN, LINES[1], LINES[2]] : LINES;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = phase === "in" ? (reduced ? 700 : 4200) : (reduced ? 500 : 2200);
    const timer = window.setTimeout(() => {
      if (phase === "in") setPhase("out");
      else if (index < lines.length - 1) {
        setIndex((value) => value + 1);
        setPhase("in");
      } else done.current();
    }, wait);
    return () => window.clearTimeout(timer);
  }, [phase, index]);
  return <p className={`fate-oracle is-${phase}`}>{lines[index]}</p>;
}

function SkyGather({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const ping = () => {
      const frame = document.querySelector("iframe.river-frame");
      if (frame instanceof HTMLIFrameElement) {
        frame.contentWindow?.postMessage({ type: "worldcal", event: "fate-gather" }, "*");
      }
    };
    ping();
    const retry = window.setInterval(ping, 400);
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "star-river" && data.event === "fate-gathered") done.current();
    };
    window.addEventListener("message", onMessage);
    const backup = window.setTimeout(() => done.current(), 12000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(retry);
      window.clearTimeout(backup);
    };
  }, []);
  return null;
}

function BurnReading({ text, onDone }: { text: string; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const plate = document.createElement("canvas");
    plate.width = canvas.width;
    plate.height = canvas.height;
    const pen = plate.getContext("2d");
    if (!pen) return;
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    pen.fillStyle = "#e7eef8";
    pen.font = "15px Songti SC, Noto Serif SC, serif";
    pen.textAlign = "center";
    pen.textBaseline = "top";
    const max = Math.min(460, width - 64);
    const lines: string[] = [];
    let line = "";
    for (const char of text) {
      const next = line + char;
      if (pen.measureText(next).width > max && line) {
        lines.push(line);
        line = char.trim() ? char : "";
      } else line = next;
    }
    if (line) lines.push(line);
    const lineHeight = 28;
    let top = Math.max(48, (height - lines.length * lineHeight) / 2);
    for (const row of lines) {
      pen.fillText(row, width / 2, top);
      top += lineHeight;
    }
    const pixels = pen.getImageData(0, 0, plate.width, plate.height).data;
    const particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    const step = Math.max(3, Math.round(dpr * 3));
    for (let py = 0; py < plate.height && particles.length < 700; py += step) {
      for (let px = 0; px < plate.width && particles.length < 700; px += step) {
        if (pixels[(py * plate.width + px) * 4 + 3] < 40) continue;
        const x = px / dpr;
        const y = py / dpr;
        const angle = Math.random() * Math.PI * 2;
        const speed = reduced ? 0.04 : 0.04 + Math.random() * 0.12;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: 0.08 + Math.random() * 0.18,
          life: 1,
        });
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      let alive = false;
      ctx.fillStyle = "#f3f6ff";
      for (const particle of particles) {
        particle.life -= dt * (reduced ? 0.45 : 0.12);
        if (particle.life <= 0) continue;
        alive = true;
        particle.x += particle.vx + Math.sin(now / 700 + particle.y) * 0.08;
        particle.y += particle.vy;
        ctx.globalAlpha = particle.life;
        ctx.fillRect(particle.x, particle.y, 1.1, 1.1);
      }
      if (alive) frame = requestAnimationFrame(draw);
      else done.current();
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [text]);
  return <canvas ref={ref} className="fate-burn" aria-hidden="true" />;
}
