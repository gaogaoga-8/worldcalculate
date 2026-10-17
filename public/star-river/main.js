(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const HOME = window.STAR_HOME;
  const TIMELINE = window.STAR_TIMELINE;

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;

  const cv = document.getElementById('sky');
  const ctx = cv.getContext('2d');
  const gcv = document.getElementById('galaxy');
  const gctx = gcv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const STORE_KEY = 'star-river:galaxy';
  let galaxy = null;
  const env = {
    get W() { return W; },
    get H() { return H; },
    get reduced() { return reduced; },
    now: () => performance.now(),
  };

  /* ================= 背景：静态底图 + 独立星点层 ================= */
  const sky = { base: null, atlas: null, w: 0, h: 0, n: 0 };
  let S = null; // 星点参数（typed arrays）

  function rankFilter(src, w, h, r, pick) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let v = src[row + x];
        for (let k = -r; k <= r; k++) v = pick(v, src[row + clamp(x + k, 0, w - 1)]);
        tmp[row + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = tmp[y * w + x];
        for (let k = -r; k <= r; k++) v = pick(v, tmp[clamp(y + k, 0, h - 1) * w + x]);
        out[y * w + x] = v;
      }
    }
    return out;
  }

  function boxMean(src, w, h, r) {
    const W1 = w + 1, I = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = 0; x < w; x++) {
        acc += src[y * w + x];
        I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + acc;
      }
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        out[y * w + x] = (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((y1 - y0) * (x1 - x0));
      }
    }
    return out;
  }

  // 手机上按可见区域出图，避免在 2300px 原图上做星点分离。
  function workingWidth(nw, nh) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cover = Math.max(innerWidth / nw, innerHeight / nh);
    const cap = innerWidth >= 900 ? 1400 : 1000;
    return Math.max(640, Math.min(nw, Math.round(nw * cover * dpr), cap));
  }

  function gradeSky(img) {
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const tw = workingWidth(nw, nh);
    const th = Math.max(1, Math.round(nh * (tw / nw)));
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.filter = 'contrast(1.34) brightness(1.22)';
    g.drawImage(img, 0, 0, tw, th);
    g.filter = 'none';
    return c;
  }

  // 把稀疏区域里的星点从原图中剥离成小贴片；吸积盘等密集区域保留在底图中不动。
  // 底图 + 贴片（叠加）在原位时与原图逐像素一致。
  function separate(img) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, n = w * h;
    const scale = w / 500;
    const rad = Math.max(2, Math.round(2 * scale));
    const densR = Math.max(10, Math.round(10 * scale));
    const grow = Math.max(1, Math.round(scale));
    const own = img instanceof HTMLCanvasElement;
    const c = own ? img : document.createElement('canvas');
    if (!own) { c.width = w; c.height = h; }
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!own) g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, w, h), px = id.data;

    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    const opened = rankFilter(rankFilter(L, w, h, rad, Math.min), w, h, rad, Math.max);
    const density = boxMean(L, w, h, densR);

    const frac = new Float32Array(n), res = new Float32Array(n), mark = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const sparse = clamp((40 - density[i]) / 22);
      const r = (L[i] - opened[i]) * sparse;
      res[i] = r;
      frac[i] = L[i] > 0 ? r / L[i] : 0;
      if (r > 6) mark[i] = 1;
    }
    const grown = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mark[y * w + x]) continue;
        for (let dy = -grow; dy <= grow; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -grow; dx <= grow; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < w) grown[yy * w + xx] = 1;
          }
        }
      }
    }

    const MAX = Math.max(13, Math.round(13 * scale)), PAD = Math.max(1, Math.round(scale)), ATLAS_W = 4096, ROW_H = MAX + PAD * 2;
    const seen = new Uint8Array(n), stack = new Int32Array(n), pix = new Int32Array(n);
    const comps = [];
    let pixLen = 0;
    for (let i = 0; i < n; i++) {
      if (!grown[i] || seen[i]) continue;
      const start = pixLen;
      let sp = 0, minX = w, minY = h, maxX = 0, maxY = 0, peak = 0;
      stack[sp++] = i; seen[i] = 1;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p / w) | 0;
        pix[pixLen++] = p;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (res[p] > peak) peak = res[p];
        if (x > 0 && grown[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < w - 1 && grown[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
        if (y > 0 && grown[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
        if (y < h - 1 && grown[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      if (peak >= 12 && bw <= MAX && bh <= MAX) comps.push({ start, end: pixLen, minX, minY, bw, bh });
    }

    // 货架式打包到一张贴图集
    let cx = 0, rows = 1;
    for (const k of comps) {
      const pw = k.bw + PAD * 2;
      if (cx + pw > ATLAS_W) { cx = 0; rows++; }
      k.ax = cx; k.ay = (rows - 1) * ROW_H;
      cx += pw;
    }
    const atlasH = rows * ROW_H;
    const atlas = document.createElement('canvas');
    atlas.width = ATLAS_W; atlas.height = atlasH;
    const ag = atlas.getContext('2d');
    const ad = ag.createImageData(ATLAS_W, atlasH), a = ad.data;

    const m = comps.length;
    S = {
      x: new Float32Array(m), y: new Float32Array(m), w: new Float32Array(m), h: new Float32Array(m),
      sx: new Float32Array(m), sy: new Float32Array(m),
      ax: new Float32Array(m), ay: new Float32Array(m), cr: new Float32Array(m), sr: new Float32Array(m),
      om: new Float32Array(m), ph: new Float32Array(m), ox: new Float32Array(m), oy: new Float32Array(m),
      td: new Float32Array(m), tw: new Float32Array(m),
    };

    comps.forEach((k, j) => {
      for (let q = k.start; q < k.end; q++) {
        const p = pix[q], x = p % w, y = (p / w) | 0, f = frac[p];
        const o = ((k.ay + PAD + y - k.minY) * ATLAS_W + (k.ax + PAD + x - k.minX)) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const v = px[p * 4 + ch], keep = Math.round(v * (1 - f));
          px[p * 4 + ch] = keep;
          a[o + ch] = v - keep;
        }
        a[o + 3] = 255;
      }
      S.x[j] = k.minX - PAD; S.y[j] = k.minY - PAD;
      S.w[j] = k.bw + PAD * 2; S.h[j] = k.bh + PAD * 2;
      S.sx[j] = k.ax; S.sy[j] = k.ay;

      // 每颗星沿一条小椭圆闭合轨道缓慢循环，周期与幅度各不相同
      const amp = (8 + Math.random() * 18) * scale;
      const rot = Math.random() * Math.PI;
      S.ax[j] = amp; S.ay[j] = amp * (0.35 + Math.random() * 0.65);
      S.cr[j] = Math.cos(rot); S.sr[j] = Math.sin(rot);
      S.om[j] = (TAU / (20 + Math.random() * 40)) * (Math.random() < 0.5 ? -1 : 1);
      S.ph[j] = Math.random() * TAU;
      S.ox[j] = Math.cos(S.ph[j]) * S.ax[j];
      S.oy[j] = Math.sin(S.ph[j]) * S.ay[j];
      S.td[j] = 0.15 + Math.random() * 0.4;
      S.tw[j] = TAU / (2 + Math.random() * 5);
    });
    ag.putImageData(ad, 0, 0);
    g.putImageData(id, 0, 0);

    sky.base = c; sky.atlas = atlas; sky.n = m;
  }

  let skyT = 0, skyDirty = true, lastSky = 0;

  function drawSky() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!sky.base) return;
    const wide = W / H > sky.w / sky.h;
    const k = wide ? H / sky.h : Math.max(W / sky.w, H / sky.h);
    const dw = sky.w * k, dh = sky.h * k;
    const ox = (W - dw) / 2, oy = (H - dh) / 2;
    ctx.drawImage(sky.base, ox, oy, dw, dh);
    if (sky.n) {
      ctx.globalCompositeOperation = 'lighter';
      const t = skyT, A = sky.atlas;
      for (let j = 0; j < sky.n; j++) {
        const ang = S.om[j] * t + S.ph[j];
        const ex = Math.cos(ang) * S.ax[j] - S.ox[j], ey = Math.sin(ang) * S.ay[j] - S.oy[j];
        const dx = ex * S.cr[j] - ey * S.sr[j], dy = ex * S.sr[j] + ey * S.cr[j];
        ctx.globalAlpha = 1 - S.td[j] * (0.5 - 0.5 * Math.cos(S.tw[j] * t));
        const w = S.w[j], h = S.h[j];
        ctx.drawImage(A, S.sx[j], S.sy[j], w, h, ox + (S.x[j] + dx) * k, oy + (S.y[j] + dy) * k, w * k, h * k);
      }
    }
    if (wide && ox > 1) fadeSides(ox, dw);
  }

  function fadeSides(ox, dw) {
    const into = Math.min(140, Math.max(48, dw * 0.12));
    const out = Math.min(ox * 0.55, 220);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const left = ctx.createLinearGradient(ox + into, 0, ox - out, 0);
    left.addColorStop(0, 'rgba(0,0,0,0)');
    left.addColorStop(1, '#000');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, ox + into, H);
    const edge = ox + dw;
    const right = ctx.createLinearGradient(edge - into, 0, edge + out, 0);
    right.addColorStop(0, 'rgba(0,0,0,0)');
    right.addColorStop(1, '#000');
    ctx.fillStyle = right;
    ctx.fillRect(edge - into, 0, W - (edge - into), H);
  }

  /* ================= 三颗星 ================= */
  const seeds = [...document.querySelectorAll('.seed')].map((el) => {
    const key = el.dataset.key;
    const amp = 10 + Math.random() * 8, ph = Math.random() * TAU;
    el.style.setProperty('--twd', `${(2.5 + Math.random() * 3).toFixed(2)}s`);
    el.style.setProperty('--twdl', `${(-Math.random() * 5).toFixed(2)}s`);
    return {
      key, el,
      star: el.querySelector('.star'),
      panel: el.querySelector('.panel'),
      ok: el.querySelector('.ok'),
      inputs: [...el.querySelectorAll('input')],
      clock: 0,
      ax: amp, ay: amp * (0.6 + Math.random() * 0.3), ph,
      om: (TAU / (26 + Math.random() * 16)) * (Math.random() < 0.5 ? -1 : 1),
      state: { ...HOME[key] },
      done: false,
      value: null,
    };
  });
  const byKey = Object.fromEntries(seeds.map((s) => [s.key, s]));

  // 'input'：可填写；'pending'：三颗已完成，等待开场；'playing'：时间线播放中；'settled'：停在归位结果
  let phase = 'input';
  let open = null;
  let regions = [];
  let gender = '';
  let authNeeded = true;
  let claimWait = null;
  let claiming = false;

  function field(s, name) {
    return s.panel.querySelector(`[name="${name}"]`);
  }

  function fillRange(select, from, to, step, suffix, pad = false) {
    const current = select.value;
    const options = [new Option('–', '')];
    const last = step < 0 ? (n) => n >= to : (n) => n <= to;
    for (let n = from; last(n); n += step) {
      const text = pad ? `${String(n).padStart(2, '0')}${suffix}` : `${n}${suffix}`;
      options.push(new Option(text, String(n)));
    }
    select.replaceChildren(...options);
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function refreshDays(s) {
    const year = Number(field(s, 'year').value);
    const month = Number(field(s, 'month').value);
    const day = field(s, 'day');
    const count = year && month ? new Date(year, month, 0).getDate() : 31;
    fillRange(day, 1, count, 1, '');
  }

  function fillBirth(s) {
    const year = new Date().getFullYear();
    fillRange(field(s, 'year'), year, 1901, -1, '');
    fillRange(field(s, 'month'), 1, 12, 1, '');
    fillRange(field(s, 'hour'), 0, 23, 1, '', true);
    fillRange(field(s, 'minute'), 0, 59, 1, '', true);
    refreshDays(s);
  }

  function fillCities(s) {
    const province = field(s, 'province').value;
    const city = field(s, 'city');
    const keep = city.value;
    const found = regions.find((item) => item.name === province);
    city.disabled = !found;
    city.replaceChildren(new Option('–', ''), ...(found ? found.cities : []).map((name) => new Option(name, name)));
    if (found && found.cities.includes(keep)) city.value = keep;
  }

  function setRegions(list) {
    regions = list.filter((item) => item && item.name && Array.isArray(item.cities));
    const origin = byKey.origin;
    if (!origin) return;
    const province = field(origin, 'province');
    const current = province.value;
    province.replaceChildren(new Option('–', ''), ...regions.map((item) => new Option(item.name, item.name)));
    if ([...province.options].some((option) => option.value === current)) province.value = current;
    fillCities(origin);
    if (origin.value) writeValue(origin, origin.value);
  }

  function samePlace(name, place) {
    const bare = String(place || '').replace(/市$/u, '');
    return name === place || name.replace(/市$/u, '') === bare;
  }

  function readValue(s) {
    if (s.key === 'origin') {
      const city = field(s, 'city').value;
      return city ? { place: city } : null;
    }
    if (s.key === 'birth') {
      const year = field(s, 'year').value;
      const month = field(s, 'month').value;
      const day = field(s, 'day').value;
      const hour = field(s, 'hour').value;
      const minute = field(s, 'minute').value;
      if (![year, month, day, hour, minute].every(Boolean)) return null;
      const born = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
      if (Number(day) > new Date(Number(year), Number(month), 0).getDate() || born > new Date()) return null;
      const pad = (value) => String(value).padStart(2, '0');
      return { date: `${year}-${pad(month)}-${pad(day)}`, time: `${pad(hour)}:${pad(minute)}` };
    }
    if (s.key === 'sign') {
      const name = field(s, 'name').value.trim();
      const secret = field(s, 'secret').value;
      if (!name || !gender) return null;
      if (authNeeded && secret.length < 4) return null;
      return authNeeded ? { name, gender, secret } : { name, gender };
    }
    const v = Object.fromEntries(s.inputs.map((i) => [i.name, i.value.trim()]));
    if (!Object.values(v).every(Boolean)) return null;
    return v;
  }

  function driftOffset(s) {
    const ang = s.om * s.clock + s.ph;
    return [Math.cos(ang) * s.ax - Math.cos(s.ph) * s.ax, Math.sin(ang) * s.ay - Math.sin(s.ph) * s.ay];
  }

  function writeValue(s, v) {
    if (s.key === 'origin') {
      const place = v?.place || '';
      const region = regions.find((item) => item.cities.some((name) => samePlace(name, place)));
      field(s, 'province').value = region ? region.name : '';
      fillCities(s);
      field(s, 'city').value = region ? (region.cities.find((name) => samePlace(name, place)) || '') : '';
      return;
    }
    if (s.key === 'birth') {
      if (!v?.date || !v?.time) return;
      const [year, month, day] = v.date.split('-');
      const [hour, minute] = v.time.split(':');
      field(s, 'year').value = String(Number(year));
      field(s, 'month').value = String(Number(month));
      refreshDays(s);
      field(s, 'day').value = String(Number(day));
      field(s, 'hour').value = String(Number(hour));
      field(s, 'minute').value = String(Number(minute));
      return;
    }
    s.inputs.forEach((i) => {
      const next = v ? v[i.name] : '';
      i.value = next == null ? '' : next;
    });
    if (s.key === 'sign') {
      gender = v?.gender || '';
      s.el.querySelectorAll('[data-gender]').forEach((button) => {
        button.classList.toggle('on', button.dataset.gender === gender);
      });
    }
  }

  function validate(s) {
    s.ok.disabled = !readValue(s);
  }

  function openSeed(s) {
    if (phase !== 'input' || open === s) return;
    if (open) closeSeed(open, false);
    open = s;
    s.el.classList.toggle('flip-x', s.state.x > 0.55);
    s.panel.style.removeProperty('--shift');
    const r = s.panel.getBoundingClientRect();
    const shift = r.left < 8 ? 8 - r.left : r.right > W - 8 ? W - 8 - r.right : 0;
    s.panel.style.setProperty('--shift', `${shift}px`);
    s.el.classList.add('open');
    s.panel.inert = false;
    s.star.setAttribute('aria-expanded', 'true');
    validate(s);
    const fields = [...s.panel.querySelectorAll('input, select')];
    const first = fields.find((item) => !item.value) || fields[0];
    first?.focus({ preventScroll: true });
  }

  function closeSeed(s, commit) {
    if (commit) {
      s.value = readValue(s);
      s.done = true;
      s.el.classList.add('done');
    } else if (s.done) {
      writeValue(s, s.value);
    }
    s.el.classList.remove('open');
    s.panel.inert = true;
    s.star.setAttribute('aria-expanded', 'false');
    if (s.panel.contains(document.activeElement)) document.activeElement.blur();
    if (open === s) open = null;
  }

  function signFault(text) {
    const fault = byKey.sign.panel.querySelector('.fault');
    if (!fault) return;
    fault.hidden = !text;
    fault.textContent = text || '';
  }

  function applyAuth() {
    document.body.classList.toggle('ask-secret', authNeeded);
    if (!authNeeded) {
      const secret = field(byKey.sign, 'secret');
      if (secret) secret.value = '';
      signFault('');
    }
    validate(byKey.sign);
  }

  function claimSign() {
    const sign = byKey.sign.value || {};
    return new Promise((resolve) => {
      claimWait = resolve;
      window.parent.postMessage({
        type: 'star-river',
        event: 'claim',
        name: sign.name || '',
        secret: sign.secret || '',
      }, '*');
      setTimeout(() => {
        if (claimWait !== resolve) return;
        claimWait = null;
        resolve({ ok: false, message: '暂时没连上，再试一次。' });
      }, 12000);
    });
  }

  async function finishSeed(s) {
    if (s.key === 'sign' && authNeeded) {
      claiming = true;
      const result = await claimSign();
      claiming = false;
      if (phase !== 'input') return;
      if (!result?.ok) {
        s.done = false;
        s.el.classList.remove('done');
        signFault(result?.message || '暗语对不上。');
        openSeed(s);
        return;
      }
      signFault('');
      authNeeded = false;
      applyAuth();
      if (result.restore) return;
    }
    if (claiming || !seeds.every((item) => item.done)) return;
    phase = 'pending';
    document.body.classList.add('locked');
    buildGalaxy([]);
    save();
    setTimeout(startTimeline, 700);
  }

  seeds.forEach((s) => {
    s.star.addEventListener('click', () => {
      if (phase === 'settled') {
        const pick = { sign: 'core', origin: 'ming', birth: 'health' }[s.key];
        if (pick) window.parent.postMessage({ type: 'star-river', event: 'pick', id: pick }, '*');
        return;
      }
      openSeed(s);
    });
    s.inputs.forEach((i) => i.addEventListener('input', () => validate(s)));
    s.inputs.forEach((i) => i.addEventListener('change', () => validate(s)));
    if (s.key === 'sign') {
      s.el.querySelectorAll('[data-gender]').forEach((button) => {
        button.addEventListener('click', () => {
          gender = button.dataset.gender;
          s.el.querySelectorAll('[data-gender]').forEach((item) => item.classList.toggle('on', item === button));
          validate(s);
        });
      });
    }
    s.panel.querySelectorAll('select').forEach((select) => {
      select.addEventListener('change', () => {
        if (select.name === 'province') fillCities(s);
        if (select.name === 'year' || select.name === 'month') refreshDays(s);
        validate(s);
      });
    });
    s.panel.addEventListener('submit', (e) => {
      e.preventDefault();
      if (phase !== 'input' || !readValue(s)) return;
      closeSeed(s, true);
      void finishSeed(s);
    });
    s.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSeed(s, false);
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        s.panel.requestSubmit();
      }
    });
  });

  document.addEventListener('pointerdown', (e) => {
    if (open && !open.el.contains(e.target)) closeSeed(open, false);
  });

  /* ================= 动画时间线 ================= */
  let stageIndex = -1, stageStart = 0, stageFrom = null, stageTo = null;

  const resolve = (spec, cur) => {
    if (spec === 'current') return { ...cur };
    return { ...cur, ...(typeof spec === 'function' ? spec(galaxy) : spec) };
  };

  function beginStage(i, now) {
    stageIndex = i;
    stageStart = now;
    stageFrom = {}; stageTo = {};
    TIMELINE[i].onStart?.(galaxy, TIMELINE[i]);
    const st = TIMELINE[i].stars;
    for (const s of seeds) {
      const spec = st[s.key] || { from: 'current', to: 'current' };
      stageFrom[s.key] = resolve(spec.from, s.state);
      stageTo[s.key] = resolve(spec.to, stageFrom[s.key]);
    }
  }

  function startTimeline() {
    if (phase !== 'pending') return;
    phase = 'playing';
    document.body.classList.add('playing');
    if (reduced || !TIMELINE.length) return finishTimeline();
    beginStage(0, performance.now());
  }

  function finishTimeline() {
    for (const stage of TIMELINE) {
      stage.onStart?.(galaxy, stage);
      for (const s of seeds) {
        const spec = stage.stars[s.key];
        if (spec) s.state = resolve(spec.to, resolve(spec.from, s.state));
      }
    }
    settle();
  }

  function settle() {
    phase = 'settled';
    stageIndex = -1;
    document.body.classList.remove('playing');
    nameSeven();
    const values = Object.fromEntries(seeds.map((s) => [s.key, s.value]));
    window.parent.postMessage({ type: 'star-river', event: 'settled', values }, '*');
  }

  function stepTimeline(now) {
    while (stageIndex >= 0) {
      const stage = TIMELINE[stageIndex];
      const t = stage.duration > 0 ? clamp((now - stageStart) / stage.duration) : 1;
      for (const s of seeds) {
        const from = stageFrom[s.key], to = stageTo[s.key];
        if (stage.motion) {
          s.state = { ...from, ...stage.motion({ key: s.key, from, to, t, galaxy }) };
        } else {
          const e = easeInOut(t), next = {};
          for (const f in to) next[f] = typeof to[f] === 'number' ? lerp(from[f], to[f], e) : to[f];
          s.state = next;
        }
      }
      if (t < 1) return;
      if (stageIndex + 1 < TIMELINE.length) {
        beginStage(stageIndex + 1, stageStart + stage.duration);
      } else {
        settle();
      }
    }
  }

  /* ================= 主循环 ================= */
  const MEMBER_TITLES = { c0: '官', c1: '财', c2: '妻', c3: '子' };
  const SEED_TITLES = { sign: '本命', origin: '命', birth: '疾' };
  const members = Object.entries(MEMBER_TITLES).map(([id, title]) => {
    const el = document.createElement('button');
    el.className = 'member';
    el.type = 'button';
    el.dataset.id = id;
    el.setAttribute('aria-label', title);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = title;
    el.append(name);
    el.addEventListener('click', () => {
      const pick = { c0: 'career', c1: 'wealth', c2: 'spouse', c3: 'child' }[id];
      window.parent.postMessage({ type: 'star-river', event: 'pick', id: pick }, '*');
    });
    document.body.append(el);
    return el;
  });

  function nameSeven() {
    document.body.classList.add('named');
    for (const s of seeds) {
      const title = SEED_TITLES[s.key];
      const name = s.el.querySelector('.name');
      if (name && title) name.textContent = title;
      if (title) s.star.setAttribute('aria-label', title);
    }
  }

  function placeMembers() {
    if (!galaxy || !document.body.classList.contains('named')) return;
    for (const point of galaxy.companionPoints()) {
      const el = members.find((item) => item.dataset.id === point.id);
      if (!el) continue;
      el.style.transform = `translate3d(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0)`;
    }
  }

  // 每天点亮的星贴在七颗星上方的暗处，不跟着轨道转，也不落进吸积盘。
  let dailyStars = [];
  const dailyEls = new Map();

  function placeDaily() {
    if (!document.body.classList.contains('named')) return;
    const pts = seeds.map((s) => ({ x: s.state.x * W, y: s.state.y * H }));
    if (galaxy) pts.push(...galaxy.companionPoints());
    if (!pts.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const els = [...dailyEls.values()].sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
    const n = els.length;
    if (!n) return;
    const top = minY - 36;
    els.forEach((el, i) => {
      const span = Math.min(W - 72, Math.max(maxX - minX, (n - 1) * 64));
      const mid = (minX + maxX) / 2;
      const start = mid - span / 2;
      const step = n === 1 ? 0 : span / (n - 1);
      const x = Math.min(W - 36, Math.max(36, n === 1 ? mid : start + step * i));
      const y = Math.min(H - 28, Math.max(22, top >= 22 ? top : minY + ((maxY - minY) * (i + 1)) / (n + 1)));
      el.classList.toggle('flip', x > W * 0.72);
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    });
  }

  function renderDaily() {
    const keep = new Set(dailyStars.map((star) => star.id));
    for (const [id, el] of dailyEls) {
      if (keep.has(id)) continue;
      el.remove();
      dailyEls.delete(id);
    }
    dailyStars.forEach((star, index) => {
      let el = dailyEls.get(star.id);
      if (!el) {
        el = document.createElement('button');
        el.className = 'member daily';
        el.type = 'button';
        const core = document.createElement('i');
        core.className = 'core';
        const name = document.createElement('span');
        name.className = 'name';
        el.append(core, name);
        el.addEventListener('click', () => {
          window.parent.postMessage({ type: 'star-river', event: 'pick', id: `round:${el.dataset.starId}` }, '*');
        });
        document.body.append(el);
        dailyEls.set(star.id, el);
      }
      el.dataset.starId = star.id;
      el.dataset.index = String(index);
      el.setAttribute('aria-label', star.title);
      el.querySelector('.name').textContent = star.title;
    });
    placeDaily();
  }

  function placeSeeds() {
    for (const s of seeds) {
      const st = s.state;
      s.el.style.transform = `translate3d(${(st.x * W).toFixed(2)}px, ${(st.y * H).toFixed(2)}px, 0)`;
      s.el.style.setProperty('--s', (st.scale ?? 1).toFixed(3));
      s.el.style.setProperty('--g', (st.glow ?? 1).toFixed(3));
    }
  }

  function updateDrift(dt) {
    for (const s of seeds) {
      if (!reduced && open !== s) s.clock += dt;
      const [dx, dy] = driftOffset(s), home = HOME[s.key];
      s.state = { ...home, x: home.x + dx / W, y: home.y + dy / H };
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (phase === 'input' || phase === 'pending') updateDrift(dt);
    else if (phase === 'playing') stepTimeline(now);
    if (phase === 'settled' && galaxy) {
      galaxy.update(dt, !reduced);
      for (const s of seeds) s.state = galaxy.orbitState(s.key);
    }
    placeSeeds();
    placeMembers();
    placeDaily();

    if (!reduced) skyT += dt;
    if (skyDirty || (!reduced && sky.n && now - lastSky > 30)) {
      drawSky();
      lastSky = now;
      skyDirty = false;
    }
    if (galaxy) drawGalaxy();
    requestAnimationFrame(frame);
  }

  function drawGalaxy() {
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, gcv.width, gcv.height);
    if (!galaxy) return;
    gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (phase === 'playing' && !reduced) {
      for (const s of seeds) galaxy.recordTrail(s.key, s.state.x * W, s.state.y * H);
    } else {
      galaxy.fadeTrails();
    }
    galaxy.draw(gctx, skyT);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    for (const c of [cv, gcv]) {
      c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    }
    for (const context of [ctx, gctx]) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'low';
    }
    skyDirty = true;
  }

  /* ================= 星系：生成、保存、聊天增长 ================= */
  function buildGalaxy(chats) {
    const values = Object.fromEntries(seeds.map((s) => [s.key, s.value]));
    galaxy = window.createGalaxy(values, env, chats);
    for (const s of seeds) s.el.style.setProperty('--tint', galaxy.tints[s.key].join(','));
  }

  function save() {
    if (!galaxy) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        values: Object.fromEntries(seeds.map((s) => {
          const value = s.value ? { ...s.value } : s.value;
          if (value) delete value.secret;
          return [s.key, value];
        })),
        chats: galaxy.grown.map((g) => g.h),
      }));
    } catch (err) { /* 隐私模式下不可写，星系仅保留在本次会话 */ }
  }

  function restore() {
    let data;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (err) { return; }
    if (!data?.values || !seeds.every((s) => data.values[s.key])) return;
    for (const s of seeds) {
      s.value = data.values[s.key];
      s.done = true;
      writeValue(s, s.value);
      s.el.classList.add('done');
    }
    buildGalaxy(data.chats || []);
    galaxy.spawnStart = -Infinity;
    phase = 'settled';
    document.body.classList.add('locked');
    nameSeven();
    window.parent.postMessage({ type: 'star-river', event: 'settled', values: data.values }, '*');
  }

  window.starRiver = {
    // 用户每发一条聊天消息调用一次；星系未生成或动画未结束时返回 false
    chat(text) {
      if (!galaxy || phase !== 'settled') return false;
      galaxy.addChat(text);
      save();
      return true;
    },
    get chats() { return galaxy ? galaxy.count : 0; },
    reset() {
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
      location.reload();
    },
  };

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'worldcal') return;
    if (data.event === 'cities' && Array.isArray(data.regions)) {
      setRegions(data.regions);
      if (phase === 'settled') {
        const values = Object.fromEntries(seeds.map((s) => [s.key, s.value]));
        window.parent.postMessage({ type: 'star-river', event: 'settled', values }, '*');
      }
    }
    if (data.event === 'auth') {
      authNeeded = data.needed !== false;
      applyAuth();
    }
    if (data.event === 'claim-result' && claimWait) {
      const done = claimWait;
      claimWait = null;
      done(data);
    }
    if (data.event === 'chat') window.starRiver.chat(String(data.text || ''));
    if (data.event === 'rounds' && Array.isArray(data.stars)) {
      dailyStars = data.stars.filter((star) => star && star.id && star.title).slice(0, 7);
      renderDaily();
    }
    if (data.event === 'cover') {
      document.body.classList.add('covered');
      if (galaxy) galaxy.covered = true;
    }
  });
  window.parent.postMessage({ type: 'star-river', event: 'need-cities' }, '*');

  const params = new URLSearchParams(location.search);
  if (params.has('reset')) {
    try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
  }
  fillBirth(byKey.birth);
  restore();

  if (params.has('debug')) {
    const btn = document.createElement('button');
    btn.className = 'debug-chat';
    btn.type = 'button';
    btn.setAttribute('aria-label', '模拟一次聊天');
    btn.textContent = '+';
    btn.addEventListener('click', () => {
      window.starRiver.chat(`${Date.now()}-${Math.random()}`);
      btn.dataset.n = window.starRiver.chats;
    });
    document.body.append(btn);
  }

  motionQuery.addEventListener('change', (e) => {
    reduced = e.matches;
    skyDirty = true;
    if (reduced && phase === 'playing') finishTimeline();
  });

  addEventListener('resize', resize);
  resize();

  const img = new Image();
  img.src = 'assets/sky.jpg';
  img.decode().then(() => {
    const plate = gradeSky(img);
    sky.w = plate.width; sky.h = plate.height;
    sky.base = plate;
    sky.n = 0;
    skyDirty = true;
    document.body.classList.add('ready');
    setTimeout(() => {
      try { separate(plate); } catch { sky.base = plate; sky.n = 0; }
      skyDirty = true;
    }, 40);
  });

  requestAnimationFrame(frame);
})();
