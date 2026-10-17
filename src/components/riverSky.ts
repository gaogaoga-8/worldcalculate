const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

type SkyState = {
  base: CanvasImageSource | null;
  atlas: HTMLCanvasElement | null;
  w: number;
  h: number;
  n: number;
};

type StarPack = {
  x: Float32Array;
  y: Float32Array;
  w: Float32Array;
  h: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  ax: Float32Array;
  ay: Float32Array;
  cr: Float32Array;
  sr: Float32Array;
  om: Float32Array;
  ph: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  td: Float32Array;
  tw: Float32Array;
};

function rankFilter(src: Float32Array, w: number, h: number, r: number, pick: (a: number, b: number) => number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y += 1) {
    const row = y * w;
    for (let x = 0; x < w; x += 1) {
      let v = src[row + x];
      for (let k = -r; k <= r; k += 1) v = pick(v, src[row + clamp(x + k, 0, w - 1)]);
      tmp[row + x] = v;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let v = tmp[y * w + x];
      for (let k = -r; k <= r; k += 1) v = pick(v, tmp[clamp(y + k, 0, h - 1) * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

function boxMean(src: Float32Array, w: number, h: number, r: number) {
  const width = w + 1;
  const integral = new Float64Array(width * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let acc = 0;
    for (let x = 0; x < w; x += 1) {
      acc += src[y * w + x];
      integral[(y + 1) * width + x + 1] = integral[y * width + x + 1] + acc;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      out[y * w + x] = (integral[y1 * width + x1] - integral[y0 * width + x1] - integral[y1 * width + x0] + integral[y0 * width + x0]) / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

function separate(img: HTMLImageElement) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const n = w * h;
  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const g = base.getContext("2d", { willReadFrequently: true });
  if (!g) return { base: img, atlas: null, w, h, n: 0, stars: null as StarPack | null };
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, w, h);
  const px = id.data;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i += 1) L[i] = Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  const opened = rankFilter(rankFilter(L, w, h, 2, Math.min), w, h, 2, Math.max);
  const density = boxMean(L, w, h, 10);
  const frac = new Float32Array(n);
  const res = new Float32Array(n);
  const mark = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const sparse = clamp((40 - density[i]) / 22);
    const r = (L[i] - opened[i]) * sparse;
    res[i] = r;
    frac[i] = L[i] > 0 ? r / L[i] : 0;
    if (r > 6) mark[i] = 1;
  }
  const grown = new Uint8Array(n);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mark[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < w) grown[yy * w + xx] = 1;
        }
      }
    }
  }
  const MAX = 13;
  const PAD = 1;
  const ATLAS_W = 2048;
  const ROW_H = MAX + PAD * 2;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const pix = new Int32Array(n);
  const comps: { start: number; end: number; minX: number; minY: number; bw: number; bh: number; ax: number; ay: number }[] = [];
  let pixLen = 0;
  for (let i = 0; i < n; i += 1) {
    if (!grown[i] || seen[i]) continue;
    const start = pixLen;
    let sp = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let peak = 0;
    stack[sp++] = i;
    seen[i] = 1;
    while (sp) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p / w) | 0;
      pix[pixLen++] = p;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (res[p] > peak) peak = res[p];
      if (x > 0 && grown[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && grown[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && grown[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && grown[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (peak >= 12 && bw <= MAX && bh <= MAX) comps.push({ start, end: pixLen, minX, minY, bw, bh, ax: 0, ay: 0 });
  }
  let cx = 0;
  let rows = 1;
  for (const item of comps) {
    const pw = item.bw + PAD * 2;
    if (cx + pw > ATLAS_W) { cx = 0; rows += 1; }
    item.ax = cx;
    item.ay = (rows - 1) * ROW_H;
    cx += pw;
  }
  const atlas = document.createElement("canvas");
  atlas.width = ATLAS_W;
  atlas.height = rows * ROW_H;
  const ag = atlas.getContext("2d");
  if (!ag) return { base, atlas: null, w, h, n: 0, stars: null as StarPack | null };
  const ad = ag.createImageData(ATLAS_W, atlas.height);
  const a = ad.data;
  const stars: StarPack = {
    x: new Float32Array(comps.length),
    y: new Float32Array(comps.length),
    w: new Float32Array(comps.length),
    h: new Float32Array(comps.length),
    sx: new Float32Array(comps.length),
    sy: new Float32Array(comps.length),
    ax: new Float32Array(comps.length),
    ay: new Float32Array(comps.length),
    cr: new Float32Array(comps.length),
    sr: new Float32Array(comps.length),
    om: new Float32Array(comps.length),
    ph: new Float32Array(comps.length),
    ox: new Float32Array(comps.length),
    oy: new Float32Array(comps.length),
    td: new Float32Array(comps.length),
    tw: new Float32Array(comps.length),
  };
  comps.forEach((item, j) => {
    for (let q = item.start; q < item.end; q += 1) {
      const p = pix[q];
      const x = p % w;
      const y = (p / w) | 0;
      const f = frac[p];
      const o = ((item.ay + PAD + y - item.minY) * ATLAS_W + (item.ax + PAD + x - item.minX)) * 4;
      for (let ch = 0; ch < 3; ch += 1) {
        const v = px[p * 4 + ch];
        const keep = Math.round(v * (1 - f));
        px[p * 4 + ch] = keep;
        a[o + ch] = v - keep;
      }
      a[o + 3] = 255;
    }
    stars.x[j] = item.minX - PAD;
    stars.y[j] = item.minY - PAD;
    stars.w[j] = item.bw + PAD * 2;
    stars.h[j] = item.bh + PAD * 2;
    stars.sx[j] = item.ax;
    stars.sy[j] = item.ay;
    const amp = 8 + Math.random() * 18;
    const rot = Math.random() * Math.PI;
    stars.ax[j] = amp;
    stars.ay[j] = amp * (0.35 + Math.random() * 0.65);
    stars.cr[j] = Math.cos(rot);
    stars.sr[j] = Math.sin(rot);
    stars.om[j] = (TAU / (20 + Math.random() * 40)) * (Math.random() < 0.5 ? -1 : 1);
    stars.ph[j] = Math.random() * TAU;
    stars.ox[j] = Math.cos(stars.ph[j]) * stars.ax[j];
    stars.oy[j] = Math.sin(stars.ph[j]) * stars.ay[j];
    stars.td[j] = 0.15 + Math.random() * 0.4;
    stars.tw[j] = TAU / (2 + Math.random() * 5);
  });
  ag.putImageData(ad, 0, 0);
  g.putImageData(id, 0, 0);
  return { base, atlas, w, h, n: comps.length, stars };
}

export function mountRiverSky(canvas: HTMLCanvasElement, src: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const sky: SkyState = { base: null, atlas: null, w: 0, h: 0, n: 0 };
  let stars: StarPack | null = null;
  let skyT = 0;
  let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let last = performance.now();

  const draw = () => {
    const host = canvas.parentElement;
    if (!host) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < 2 || height < 2) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    if (!sky.base) return;
    const k = Math.max(width / sky.w, height / sky.h);
    const ox = (width - sky.w * k) / 2;
    const oy = (height - sky.h * k) / 2;
    ctx.drawImage(sky.base, ox, oy, sky.w * k, sky.h * k);
    if (!sky.n || !stars || !sky.atlas) return;
    ctx.globalCompositeOperation = "lighter";
    for (let j = 0; j < sky.n; j += 1) {
      const ang = stars.om[j] * skyT + stars.ph[j];
      const ex = Math.cos(ang) * stars.ax[j] - stars.ox[j];
      const ey = Math.sin(ang) * stars.ay[j] - stars.oy[j];
      const dx = ex * stars.cr[j] - ey * stars.sr[j];
      const dy = ex * stars.sr[j] + ey * stars.cr[j];
      ctx.globalAlpha = reduced ? 1 : 1 - stars.td[j] * (0.5 - 0.5 * Math.cos(stars.tw[j] * skyT));
      const sw = stars.w[j];
      const sh = stars.h[j];
      ctx.drawImage(sky.atlas, stars.sx[j], stars.sy[j], sw, sh, ox + (stars.x[j] + dx) * k, oy + (stars.y[j] + dy) * k, sw * k, sh * k);
    }
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) skyT += dt;
    draw();
    raf = requestAnimationFrame(frame);
  };

  const img = new Image();
  img.src = src;
  void img.decode().then(() => {
    sky.w = img.naturalWidth;
    sky.h = img.naturalHeight;
    try {
      const split = separate(img);
      sky.base = split.base;
      sky.atlas = split.atlas;
      sky.n = split.n;
      stars = split.stars;
    } catch {
      sky.base = img;
      sky.n = 0;
    }
  });

  raf = requestAnimationFrame(frame);
  const onResize = () => draw();
  window.addEventListener("resize", onResize);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  };
}
