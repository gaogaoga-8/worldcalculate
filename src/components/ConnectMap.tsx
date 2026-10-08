import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart } from "../bazi/chart";
import { ELEMENTS, STEMS, STEM_ELEMENT, yangStem } from "../bazi/ganzhi";
import {
  decodeGalaxy,
  encodeGalaxy,
  MIRROR_AT,
  starPosition,
  type StarLink,
} from "../galaxy";
import { updateState, useAppState } from "../store";
import { Nebula } from "./Nebula";
import { QrMark } from "./QrMark";

export function ConnectMap({
  chart,
  onOpenSelf,
}: {
  chart: Chart;
  onOpenSelf: () => void;
}) {
  const state = useAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rot, setRot] = useState(
    -(chart.person.place.longitude * Math.PI) / 180,
  );
  const [tilt, setTilt] = useState(0.35);
  const [qr, setQr] = useState(false);
  const [scan, setScan] = useState(false);
  const [roster, setRoster] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const drag = useRef<{
    x: number;
    y: number;
    rot: number;
    tilt: number;
  } | null>(null);
  const payload = useMemo(
    () =>
      encodeGalaxy({
        v: 1,
        id: state.galaxyId,
        name: chart.person.name,
        mbti: chart.person.mbti ?? null,
        pillar: chart.pillars
          .map((pillar) => (pillar.missing ? "—" : pillar.text))
          .join(" "),
        stars: state.stars.length,
        place: {
          name: chart.person.place.name,
          longitude: chart.person.place.longitude,
          latitude: chart.person.place.latitude,
        },
      }),
    [chart, state.galaxyId, state.stars.length],
  );
  const placed = state.links.filter((link) => link.place);
  const loose = state.links.filter((link) => !link.place);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => paintGlobe(ctx, canvas, chart, placed, rot, tilt);
    draw();
  }, [chart, placed, rot, tilt]);

  function connect(raw: string) {
    const card = decodeGalaxy(raw);
    if (!card) {
      setNotice("这不是一张星系码。");
      return;
    }
    if (card.id === state.galaxyId) {
      setNotice("这是你自己的星系。");
      return;
    }
    const existing = state.links.find((link) => link.id === card.id);
    const next: StarLink = {
      id: card.id,
      name: card.name,
      mbti: card.mbti,
      pillar: card.pillar,
      stars: card.stars,
      place: card.place ?? existing?.place ?? null,
      exchanges: [...(existing?.exchanges ?? []), Date.now()],
      at: existing?.at ?? Date.now(),
    };
    updateState((prev) => ({
      ...prev,
      links: existing
        ? prev.links.map((link) => (link.id === card.id ? next : link))
        : [...prev.links, next],
    }));
    setNotice(
      next.place
        ? `连上了${card.name}。这颗点按他认识自己的深度显形。`
        : `连上了${card.name}。没有坐标，落不到地球上。`,
    );
    setCode("");
    setScan(false);
    if (next.place) setRot(-(next.place.longitude * Math.PI) / 180);
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h1>连接</h1>
        <span>
          {placed.length} 个点 · {loose.length} 个无坐标
        </span>
      </header>
      <div className="panel-body sky-home">
        <div className="world-stage">
          <HoverGalaxy onOpen={onOpenSelf} />
          <canvas
            ref={canvasRef}
            className="globe"
            onPointerDown={(event) => {
              drag.current = { x: event.clientX, y: event.clientY, rot, tilt };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              setRot(
                drag.current.rot - (event.clientX - drag.current.x) * 0.008,
              );
              setTilt(
                Math.max(
                  -0.8,
                  Math.min(
                    0.9,
                    drag.current.tilt +
                      (event.clientY - drag.current.y) * 0.005,
                  ),
                ),
              );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          />
        </div>
        <p className="sky-note">
          点是互换过的人。拖动可以转地球。上方是你的星系。
        </p>
        <div className="sky-actions">
          <button className="ghost" type="button" onClick={() => setQr(true)}>
            星系二维码
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setScan(true);
              setNotice("");
            }}
          >
            连上别人
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => setRoster(true)}
          >
            罗列
          </button>
        </div>
        {notice && <p className="sky-note">{notice}</p>}
      </div>
      {qr && (
        <div className="sheet">
          <button
            className="scrim"
            aria-label="关闭"
            onClick={() => setQr(false)}
          />
          <div className="card">
            <p>整张星系 · {chart.person.name}</p>
            <QrMark text={payload} />
            <code>{payload}</code>
            <button
              className="ghost"
              type="button"
              onClick={() => void navigator.clipboard?.writeText(payload)}
            >
              复制这张码
            </button>
          </div>
        </div>
      )}
      {roster && (
        <div className="sheet">
          <button
            className="scrim"
            aria-label="关闭"
            onClick={() => setRoster(false)}
          />
          <div className="card">
            <p>连上的人</p>
            <ul className="friend-list">
              {placed.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => {
                      if (link.place)
                        setRot(-(link.place.longitude * Math.PI) / 180);
                      setRoster(false);
                    }}
                  >
                    {linkTrait(link)}
                  </button>
                  <span>
                    {link.place?.name} · {link.stars} 星 · 互换{" "}
                    {link.exchanges.length} 次
                  </span>
                </li>
              ))}
              {loose.map((link) => (
                <li key={link.id}>
                  <b>{linkTrait(link)}</b>
                  <span>没有坐标</span>
                </li>
              ))}
              {placed.length + loose.length === 0 && (
                <li>
                  <span>还没有连上的人</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
      {scan && (
        <div className="sheet">
          <button
            className="scrim"
            aria-label="关闭"
            onClick={() => setScan(false)}
          />
          <div className="card">
            <p>连上另一张星系</p>
            <button
              className="ghost"
              type="button"
              onClick={() => void startCamera(setNotice, setCode)}
            >
              打开相机扫码
            </button>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                connect(code);
              }}
            >
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="或贴上对方的星系码"
              />
              <button className="primary" type="submit">
                连上
              </button>
            </form>
            {notice && <p className="sky-note">{notice}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function HoverGalaxy({ onOpen }: { onOpen: () => void }) {
  const state = useAppState();
  const rounds = [...state.stars.filter((star) => star.kind === "round")].sort(
    (a, b) => a.litAt - b.litAt,
  );
  return (
    <button
      type="button"
      className="hover-galaxy"
      onClick={onOpen}
      aria-label="打开我的星系"
    >
      <Nebula />
      <span className="orb core" style={{ left: "50%", top: "50%" }}>
        <i />
      </span>
      {Array.from({ length: MIRROR_AT }, (_, index) => {
        const point = starPosition(index);
        return (
          <span
            key={index}
            className={`orb ${rounds[index] ? "round" : "dormant"}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <i />
          </span>
        );
      })}
      <span className="hover-galaxy-label">进入我的星系 ↗</span>
    </button>
  );
}

function paintGlobe(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  chart: Chart,
  links: StarLink[],
  rot: number,
  tilt: number,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.max(1, width * dpr);
  canvas.height = Math.max(1, height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.44;
  const mesh = geodesic();

  const project = (x: number, y: number, z: number) => {
    const spun = spin(x, y, z, rot, tilt);
    return { x: cx + spun.x * radius, y: cy - spun.y * radius, z: spun.z };
  };
  const projectPlace = (lat: number, lon: number) => {
    const φ = (lat * Math.PI) / 180;
    const λ = (lon * Math.PI) / 180;
    return project(
      Math.cos(φ) * Math.sin(λ),
      Math.sin(φ),
      Math.cos(φ) * Math.cos(λ),
    );
  };

  const points = mesh.verts.map((vert) => project(vert[0], vert[1], vert[2]));
  const edges = mesh.edges
    .map(([a, b]) => ({
      a: points[a],
      b: points[b],
      z: (points[a].z + points[b].z) / 2,
    }))
    .sort((p, q) => p.z - q.z);
  for (const edge of edges) {
    const depth =
      edge.z > 0 ? 0.62 + edge.z * 0.38 : 0.16 + (edge.z + 1) * 0.16;
    ctx.strokeStyle = `rgba(214, 216, 220, ${0.34 * depth})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(edge.a.x, edge.a.y);
    ctx.lineTo(edge.b.x, edge.b.y);
    ctx.stroke();
  }
  for (const point of points) {
    const front = point.z > 0;
    ctx.fillStyle = `rgba(200, 204, 208, ${front ? 0.2 : 0.07})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, front ? 0.85 : 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  const marks: { name: string; x: number; y: number }[] = [];
  for (const link of links) {
    if (!link.place) continue;
    const point = projectPlace(link.place.latitude, link.place.longitude);
    if (point.z < 0.05) continue;
    const halo = ctx.createRadialGradient(
      point.x,
      point.y,
      0,
      point.x,
      point.y,
      7,
    );
    halo.addColorStop(0, "rgba(244, 244, 244, 0.42)");
    halo.addColorStop(1, "rgba(244, 244, 244, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(244, 244, 244, 0.95)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.1, 0, Math.PI * 2);
    ctx.fill();
    marks.push({
      name: dayMasterLabel(link) || link.mbti || link.name,
      x: point.x,
      y: point.y,
    });
  }
  ctx.font = "300 11px Ubuntu, 'Noto Sans SC', sans-serif";
  ctx.textBaseline = "middle";
  const occupied: { x: number; y: number; w: number }[] = [];
  for (const mark of marks) {
    const textW = ctx.measureText(mark.name).width;
    let x = mark.x + 7;
    let y = mark.y;
    let align: CanvasTextAlign = "left";
    if (x + textW > width - 4) {
      x = mark.x - 7;
      align = "right";
    }
    if (
      occupied.some(
        (item) =>
          Math.abs(item.y - y) < 13 &&
          x < item.x + item.w + 2 &&
          x + textW > item.x - 2,
      )
    )
      continue;
    occupied.push({ x, y, w: textW });
    ctx.textAlign = align;
    ctx.fillStyle = "rgba(186, 190, 196, 0.55)";
    ctx.fillText(mark.name, x, y);
  }
  ctx.textAlign = "left";
  void chart;
}

type Vec = [number, number, number];

let meshCache: {
  verts: Vec[];
  edges: [number, number][];
  faces: [number, number, number][];
} | null = null;

function geodesic() {
  if (meshCache) return meshCache;
  const t = (1 + Math.sqrt(5)) / 2;
  const base = (
    [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ] as Vec[]
  ).map(unit);
  const faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const frequency = 4;
  const verts: Vec[] = [];
  const keys = new Map<string, number>();
  const add = (v: Vec) => {
    const n = unit(v);
    const key = `${n[0].toFixed(4)},${n[1].toFixed(4)},${n[2].toFixed(4)}`;
    const found = keys.get(key);
    if (found != null) return found;
    const id = verts.length;
    verts.push(n);
    keys.set(key, id);
    return id;
  };
  const ids = base.map(add);
  const edges = new Set<string>();
  const facesOut: [number, number, number][] = [];
  const link = (a: number, b: number) => {
    if (a === b) return;
    edges.add(a < b ? `${a}:${b}` : `${b}:${a}`);
  };
  for (const [ia, ib, ic] of faces) {
    const a = verts[ids[ia]];
    const b = verts[ids[ib]];
    const c = verts[ids[ic]];
    const grid: number[][] = [];
    for (let i = 0; i <= frequency; i += 1) {
      grid[i] = [];
      for (let j = 0; j <= frequency - i; j += 1) {
        const k = frequency - i - j;
        grid[i][j] = add([
          (a[0] * k + b[0] * i + c[0] * j) / frequency,
          (a[1] * k + b[1] * i + c[1] * j) / frequency,
          (a[2] * k + b[2] * i + c[2] * j) / frequency,
        ]);
      }
    }
    for (let i = 0; i < frequency; i += 1) {
      for (let j = 0; j < frequency - i; j += 1) {
        const v1 = grid[i][j];
        const v2 = grid[i + 1][j];
        const v3 = grid[i][j + 1];
        link(v1, v2);
        link(v1, v3);
        link(v2, v3);
        facesOut.push([v1, v2, v3]);
        if (i + j < frequency - 1) {
          const v4 = grid[i + 1][j + 1];
          link(v2, v4);
          link(v3, v4);
          facesOut.push([v2, v4, v3]);
        }
      }
    }
  }
  meshCache = {
    verts,
    edges: [...edges].map(
      (edge) => edge.split(":").map(Number) as [number, number],
    ),
    faces: facesOut,
  };
  return meshCache;
}

function unit(v: Vec): Vec {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function spin(x: number, y: number, z: number, rot: number, tilt: number) {
  const cy = Math.cos(rot);
  const sy = Math.sin(rot);
  const x1 = x * cy + z * sy;
  const z1 = z * cy - x * sy;
  const cx = Math.cos(tilt);
  const sx = Math.sin(tilt);
  return { x: x1, y: y * cx - z1 * sx, z: y * sx + z1 * cx };
}

function dayMasterLabel(link: StarLink): string {
  const day = link.pillar.split(/\s+/).filter(Boolean)[2] ?? "";
  const stem = STEMS.findIndex((item) => item === day[0]);
  return stem >= 0
    ? `${yangStem(stem) ? "阳" : "阴"}${ELEMENTS[STEM_ELEMENT[stem]]}`
    : "";
}

function linkTrait(link: StarLink): string {
  const core = dayMasterLabel(link);
  if (core && link.mbti) return `${core} ${link.mbti}`;
  return core || link.mbti || link.name;
}

async function startCamera(
  setNotice: (value: string) => void,
  setCode: (value: string) => void,
) {
  const Detector = (
    window as unknown as {
      BarcodeDetector?: new (options: { formats: string[] }) => {
        detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
      };
    }
  ).BarcodeDetector;
  if (!Detector || !navigator.mediaDevices?.getUserMedia) {
    setNotice("这台浏览器扫不了码。把对方的星系码贴进来。");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    const found = await new Detector({ formats: ["qr_code"] }).detect(video);
    stream.getTracks().forEach((track) => track.stop());
    const value = found[0]?.rawValue;
    if (value) setCode(value);
    setNotice(
      value ? "扫到了。确认后连上。" : "画面里没有星系码。可以改用粘贴。",
    );
  } catch {
    setNotice("相机没有打开。把对方的星系码贴进来。");
  }
}
