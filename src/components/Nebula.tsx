import { useEffect, useRef, type RefObject } from "react";
import {
  dustPosition,
  easeBetween,
  formationPose,
  FORMATION_MS,
  mix,
} from "../cosmos";

export { FORMATION_MS } from "../cosmos";

type Props = {
  className?: string;
  forming?: boolean;
  formationId?: number;
  skipToken?: number;
  coreRef?: RefObject<HTMLButtonElement | null>;
  onSettled?: () => void;
};

/** The introduction and interactive sky keep the same canvas, dust and hero star. */
export function Nebula({
  className = "",
  forming = false,
  formationId = 0,
  skipToken = 0,
  coreRef,
  onSettled,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef({ forming, formationId, skipToken, coreRef, onSettled });
  scene.current = { forming, formationId, skipToken, coreRef, onSettled };

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.dataset.sceneId = crypto.randomUUID();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;
    let raf = 0,
      previous = 0,
      time = 0,
      elapsed = FORMATION_MS;
    let requestedId = -1,
      active = false,
      notified = true;
    let lastSkip = scene.current.skipToken,
      skipAt = -1,
      skipFrom = 0;
    let progress = 1,
      pointerX = 0,
      pointerY = 0,
      targetX = 0,
      targetY = 0;
    let seed = 41397;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const stars = Array.from({ length: 1800 }, (_, index) => {
      const radius = Math.pow(random(), 0.66);
      return {
        radius,
        angle:
          ((index % 3) * Math.PI * 2) / 3 +
          radius * 5.8 +
          (random() - 0.5) * 1.25,
        scatterX: random() * 2 - 1,
        scatterY: random() * 2 - 1,
        alpha: 0.18 + random() * 0.55,
        size: 0.4 + random() * 1.15,
        phase: random() * Math.PI * 2,
        depth: 0.3 + random() * 0.7,
        tint: random() < 0.12 ? 2 : random() < 0.22 ? 1 : 0,
        bright: index % 13 === 0,
      };
    });
    const distant = Array.from({ length: 90 }, () => ({
      x: random(),
      y: random(),
      alpha: 0.035 + random() * 0.11,
    }));
    const sprites = ["237,240,249", "184,207,238", "242,227,204"].map(
      (color) => {
        const sprite = document.createElement("canvas");
        sprite.width = sprite.height = 48;
        const g = sprite.getContext("2d")!;
        const light = g.createRadialGradient(24, 24, 0, 24, 24, 24);
        light.addColorStop(0, `rgba(${color},1)`);
        light.addColorStop(0.08, `rgba(${color},0.85)`);
        light.addColorStop(0.26, `rgba(${color},0.14)`);
        light.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = light;
        g.fillRect(0, 0, 48, 48);
        return sprite;
      },
    );

    const pointer = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 5;
      targetY = (event.clientY / window.innerHeight - 0.5) * 3;
    };
    const draw = () => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (
        canvas.width !== Math.round(w * dpr) ||
        canvas.height !== Math.round(h * dpr)
      ) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!w || !h) return;
      const p = reduced ? 1 : progress;
      const pose = formationPose(p, w, h);
      const t = reduced ? 0 : time / 1000;
      const cx = w * 0.5,
        cy = h * 0.48;
      const driftX = reduced ? 0 : pointerX * pose.release;
      const driftY = reduced ? 0 : pointerY * pose.release;
      const visible = reduced || !active ? 1 : easeBetween(elapsed, 0, 850);
      const hero = scene.current.coreRef?.current;
      if (hero) {
        hero.style.setProperty("--core-x", `${pose.x.toFixed(3)}px`);
        hero.style.setProperty("--core-y", `${pose.y.toFixed(3)}px`);
        hero.style.setProperty("--core-size", `${pose.size.toFixed(3)}px`);
        hero.style.setProperty("--core-alpha", String(pose.opacity * visible));
        hero.style.setProperty("--core-label", String(pose.label));
      }
      for (const star of distant) {
        ctx.fillStyle = `rgba(210,218,233,${star.alpha * visible})`;
        ctx.fillRect(star.x * w, star.y * h, 0.7, 0.7);
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const scale = Math.min(w * 0.35, h * 0.52);
      const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale);
      cloud.addColorStop(
        0,
        `rgba(132,144,178,${mix(0.055, 0.018, pose.release) * visible})`,
      );
      cloud.addColorStop(
        0.4,
        `rgba(87,98,137,${mix(0.035, 0.009, pose.release) * visible})`,
      );
      cloud.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cloud;
      ctx.fillRect(0, 0, w, h);
      for (const star of stars) {
        const point = dustPosition(star, p, t, w, h);
        const px = cx + point.x + driftX * star.depth;
        const py = cy + point.y + driftY * star.depth;
        const shimmer = reduced
          ? 0.88
          : 0.86 + Math.sin(t * 0.45 + star.phase) * 0.14;
        const alpha =
          star.alpha *
          shimmer *
          visible *
          mix(0.84, star.bright ? 0.75 : 0.24, point.release);
        const size = mix(
          5.5 + star.size * 2,
          4.4 + star.size * 2.4,
          point.release,
        );
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          sprites[star.tint],
          px - size / 2,
          py - size / 2,
          size,
          size,
        );
        // Sparse pinpoints retain individual stars after the surrounding dust disperses.
        if (star.bright) {
          ctx.fillStyle = star.tint === 2 ? "#f3e8d9" : "#e7edf8";
          ctx.beginPath();
          ctx.arc(px, py, 0.3 + star.size * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };
    const tick = (now: number) => {
      const dt = previous ? Math.min(64, now - previous) : 0;
      previous = now;
      time += dt;
      pointerX = mix(pointerX, targetX, Math.min(1, dt / 500));
      pointerY = mix(pointerY, targetY, Math.min(1, dt / 500));
      if (requestedId !== scene.current.formationId) {
        requestedId = scene.current.formationId;
        active = scene.current.forming;
        elapsed = active ? 0 : FORMATION_MS;
        progress = active ? 0 : 1;
        notified = !active;
        skipAt = -1;
        lastSkip = scene.current.skipToken;
      }
      if (active) {
        elapsed += dt;
        if (scene.current.skipToken !== lastSkip && skipAt < 0) {
          lastSkip = scene.current.skipToken;
          skipAt = elapsed;
          skipFrom = progress;
        }
        progress = reduced
          ? 1
          : skipAt >= 0
            ? mix(skipFrom, 1, easeBetween(elapsed - skipAt, 0, 1100))
            : Math.min(1, elapsed / FORMATION_MS);
      }
      draw();
      if (active && !notified && (reduced ? elapsed >= 900 : progress >= 1)) {
        active = false;
        notified = true;
        scene.current.onSettled?.();
      }
      if (!document.hidden && (!reduced || active))
        raf = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      previous = 0;
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    const motion = () => {
      reduced = media.matches;
      restart();
    };
    const observer = new ResizeObserver(() => {
      if (reduced) draw();
    });
    observer.observe(canvas);
    canvas.addEventListener("cosmos-replay", restart);
    document.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("visibilitychange", restart);
    media.addEventListener("change", motion);
    restart();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("cosmos-replay", restart);
      document.removeEventListener("pointermove", pointer);
      document.removeEventListener("visibilitychange", restart);
      media.removeEventListener("change", motion);
    };
    // Formation requests are read inside the loop; settling must never recreate this canvas.
  }, []);

  // Wake a static, reduced-motion scene when the user replays the introduction.
  useEffect(() => {
    const canvas = ref.current;
    if (
      canvas &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      canvas.dispatchEvent(new Event("cosmos-replay"));
    }
  }, [formationId]);
  return (
    <canvas ref={ref} className={`nebula ${className}`} aria-hidden="true" />
  );
}
