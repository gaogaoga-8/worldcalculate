/*
 * 属于用户自己的星系。
 *
 * 三项输入决定星系：
 *   符号（名字）    → 随机种子、中心星色调
 *   来处（地点）    → 星系在天空中的位置
 *   降生（日期时间） → 起始角度（时辰）、冷暖（月份）、旋转方向（日）
 * 同样的输入永远得到同样的星系。
 *
 * 初始六颗星：「符号」为中心星，「来处」「降生」在中层轨道，三颗伴星各由一颗原星分出。
 * 每次聊天 addChat() 增加一颗新星，整体亮度按 1 - e^(-n/25) 缓慢上升。
 */
(() => {
  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // 与图中吸积盘一致的倾斜视角
  const RATIO = 0.4;
  const ROLL = -0.06;
  const SPIN = 2.2;

  const SEED_R = { sign: 0, origin: 1.15, birth: 1.8 };
  const COMPANIONS = [
    { id: 'c0', parent: 'sign', r: 0.62 },
    { id: 'c1', parent: 'origin', r: 2.3 },
    { id: 'c2', parent: 'birth', r: 2.85 },
    { id: 'c3', parent: 'sign', r: 2.05 },
  ];
  const BANDS = [
    { r: 1.45, spread: 0.12, n: 260 },
    { r: 2.55, spread: 0.18, n: 340 },
  ];
  const GATHER_OFFSET = { origin: 0, birth: TAU / 3, sign: (TAU * 2) / 3 };
  const CENTER_TINTS = [[255, 212, 168], [188, 208, 255], [255, 198, 214], [222, 240, 255]];

  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (const ch of str) {
      const c = ch.codePointAt(0);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }

  function rng(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const mixWhite = (c, k) => c.map((v) => Math.round(lerp(255, v, k)));

  function sprite(c) {
    const S = 32, el = document.createElement('canvas');
    el.width = el.height = S;
    const g = el.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.14, `rgba(${c},0.9)`);
    gr.addColorStop(0.38, `rgba(${c},0.16)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return el;
  }

  // 角度差按旋转方向取正，并至少绕行 0.6 圈，让归位时有一段旋入的弧线
  function forwardDelta(from, to, dir) {
    let d = ((((to - from) * dir) % TAU) + TAU) % TAU;
    if (d < TAU * 0.6) d += TAU;
    return d * dir;
  }

  // env 提供视口信息：{ W, H, now, reduced }
  window.createGalaxy = function createGalaxy(values, env, chats = []) {
    const { place } = values.origin, { date, time } = values.birth, { name } = values.sign;
    const R = rng(hash(`${name}|${place}|${date}|${time}`));
    const placeH = hash(place), nameH = hash(name);
    const [, month = 1, day = 1] = date.split('-').map(Number);
    const [hh = 0, mm = 0] = time.split(':').map(Number);

    const cx = 0.42 + 0.16 * ((placeH & 0xffff) / 0xffff);
    const cy = 0.13 + 0.04 * ((placeH >>> 16) / 0xffff);
    const dir = day % 2 ? 1 : -1;
    const base = ((hh * 60 + mm) / 1440) * TAU;
    const temp = Math.cos(((month - 7) / 12) * TAU);
    const memberTint = temp > 0 ? mixWhite([255, 222, 186], temp * 0.6) : mixWhite([196, 212, 255], -temp * 0.6);
    const centerTint = mixWhite(CENTER_TINTS[nameH % CENTER_TINTS.length], 0.6);

    const angle0 = { sign: 0 };
    ['origin', 'birth', ...COMPANIONS.map((c) => c.id)].forEach((id, i) => {
      angle0[id] = base + i * GOLDEN * 2 + (R() - 0.5) * 0.5;
    });

    const memberSprite = sprite(memberTint.join(','));
    const dustSprite = sprite('210,220,255');

    const dust = [];
    BANDS.forEach((b, layer) => {
      // 沿轨道疏密不均：两段较密的弧，其余稀疏
      const clumpPhase = R() * TAU;
      for (let i = 0; i < b.n; i++) {
        let a;
        do { a = R() * TAU; } while (R() > 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.cos(2 * a + clumpPhase), 2));
        dust.push({
          r: b.r + (R() + R() - 1) * b.spread,
          a0: a,
          size: 1.4 + Math.pow(R(), 2) * 2,
          alpha: 0.14 + R() * 0.32,
          lift: (R() - 0.5) * 0.08,
          layer,
        });
      }
    });

    const g = {
      clock: 0,
      spawnStart: null,
      spawnDur: 1,
      flashes: [],
      trails: {},
      grown: [],
      tints: { sign: centerTint, origin: memberTint, birth: memberTint },

      get count() { return this.grown.length; },
      get brightness() { return 1 - Math.exp(-this.grown.length / 25); },

      unit() { return Math.min(env.W, env.H * 0.5) * 0.14; },
      omega(r) { return (dir * TAU) / (50 + 50 * r); },

      project(r, a, lift = 0) {
        const u = this.unit();
        const x = r * u * Math.cos(a), y = r * u * RATIO * Math.sin(a) + lift * u;
        const cr = Math.cos(ROLL), sr = Math.sin(ROLL);
        return {
          px: cx * env.W + x * cr - y * sr,
          py: cy * env.H + x * sr + y * cr,
          depth: Math.sin(a),
        };
      },

      toState(p, scale, glow) {
        return { x: p.px / env.W, y: p.py / env.H, scale, glow };
      },

      memberGlow() { return 1 + 0.35 * this.brightness; },

      orbitAngle(id, r) { return angle0[id] + this.omega(r) * this.clock; },

      companionPoints() {
        return COMPANIONS.map((c) => {
          const p = this.project(c.r, this.orbitAngle(c.id, c.r));
          return { id: c.id, x: p.px, y: p.py };
        });
      },

      /* ---------- 时间线用到的三颗星状态 ---------- */
      gatherPolar(key) { return { r: 1.5, a: base + GATHER_OFFSET[key] }; },
      gatherState(key) {
        const p = this.gatherPolar(key);
        return this.toState(this.project(p.r, p.a), 1, 1.1);
      },

      spiralPolar(key, t) {
        const p = this.gatherPolar(key);
        return { r: lerp(p.r, 0.35, t * t), a: p.a + dir * TAU * SPIN * t * t };
      },
      spiralState(key, t) {
        const p = this.spiralPolar(key, t);
        return this.toState(this.project(p.r, p.a), 1 + 0.25 * t, 1.1 + 0.5 * t);
      },
      tightState(key) { return this.spiralState(key, 1); },

      settlePolar(fromPolar, id, r, t) {
        const target = angle0[id];
        const e = easeOut(t);
        return { r: lerp(fromPolar.r, r, easeInOut(t)), a: fromPolar.a + forwardDelta(fromPolar.a, target, dir) * e };
      },
      settleState(key, t) {
        const p = this.settlePolar(this.spiralPolar(key, 1), key, SEED_R[key], t);
        const pp = this.project(p.r, p.a);
        const e = easeInOut(t);
        return this.toState(pp, lerp(1.25, 1 + 0.08 * pp.depth, e), lerp(1.6, this.memberGlow(), e));
      },

      orbitState(key) {
        const r = SEED_R[key];
        const p = this.project(r, this.orbitAngle(key, r));
        return this.toState(p, 1 + 0.08 * p.depth, this.memberGlow());
      },

      /* ---------- 伴星诞生 ---------- */
      spawnCompanions(duration) {
        this.spawnDur = Math.max(1, duration);
        this.spawnStart = env.reduced ? -Infinity : env.now();
        if (env.reduced) return;
        for (const c of COMPANIONS) {
          const p = this.spiralPolar(c.parent, 1);
          const pp = this.project(p.r, p.a);
          this.flashes.push({ x: pp.px, y: pp.py, t0: env.now() });
        }
      },
      spawnProgress() {
        if (this.spawnStart === null) return 0;
        return clamp((env.now() - this.spawnStart) / this.spawnDur);
      },

      /* ---------- 聊天增长 ---------- */
      addChat(text, restoring = false) {
        const n = this.grown.length + 1;
        const h = typeof text === 'number' ? text : hash(String(text));
        const r2 = rng(h ^ Math.imul(n, 2654435761));
        const r = 0.7 + 2.6 * Math.sqrt(n / (n + 40)) + (r2() - 0.5) * 0.15;
        const warm = r2();
        this.grown.push({
          h,
          r,
          a0: base + n * GOLDEN + (r2() - 0.5) * 0.3,
          size: 0.55 + r2() * 0.6,
          alpha: 0.35 + r2() * 0.4,
          spr: sprite(mixWhite(warm < 0.5 ? [255, 224, 196] : [200, 216, 255], 0.3 + r2() * 0.4).join(',')),
          born: restoring || env.reduced ? -Infinity : this.clock,
          tw: TAU / (2.5 + r2() * 4),
          tp: r2() * TAU,
        });
        return h;
      },

      update(dt, running) {
        if (running) this.clock += dt;
      },

      recordTrail(key, x, y) {
        const t = (this.trails[key] ||= []);
        t.push({ x, y });
        if (t.length > 36) t.shift();
      },
      fadeTrails() {
        for (const k in this.trails) this.trails[k].splice(0, 2);
      },

      /* ---------- 绘制 ---------- */
      draw(ctx, twinkleT) {
        const u = this.unit(), B = this.brightness;
        const sp = this.spawnProgress();
        const settled = sp >= 1;
        ctx.globalCompositeOperation = 'lighter';

        // 星云光晕：聊天 25 次后逐渐浮现
        const neb = clamp((this.grown.length - 25) / 30);
        if (neb > 0 && settled) {
          const c = this.project(0, 0);
          ctx.save();
          ctx.translate(c.px, c.py);
          ctx.rotate(ROLL);
          ctx.scale(1, RATIO * 1.4);
          const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, u * 3.2);
          gr.addColorStop(0, `rgba(${centerTint},${0.1 * neb})`);
          gr.addColorStop(0.5, `rgba(170,185,255,${0.04 * neb})`);
          gr.addColorStop(1, 'rgba(150,170,255,0)');
          ctx.fillStyle = gr;
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(0, 0, u * 3.2, 0, TAU); ctx.fill();
          ctx.restore();
        }

        // 尘带：内层随伴星出现，外层在聊天 10 次左右浮现
        const reveal = easeInOut(sp);
        const outer = clamp((this.grown.length - 7) / 6);
        const bandW = [reveal, reveal * outer];

        // 极淡的环形辉光，提示轨道平面
        const c0 = this.project(0, 0);
        BANDS.forEach((b, i) => {
          if (bandW[i] <= 0) return;
          ctx.save();
          ctx.translate(c0.px, c0.py);
          ctx.rotate(ROLL);
          ctx.scale(1, RATIO);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = `rgba(190,205,255,${0.018 * bandW[i] * (1 + B)})`;
          ctx.lineWidth = u * b.spread * 2.6;
          ctx.beginPath(); ctx.arc(0, 0, u * b.r, 0, TAU); ctx.stroke();
          ctx.restore();
        });

        for (const d of dust) {
          const w = bandW[d.layer];
          if (w <= 0) continue;
          const p = this.project(d.r, d.a0 + this.omega(d.r) * this.clock, d.lift);
          const s = d.size * (1 + 0.12 * p.depth);
          ctx.globalAlpha = Math.min(1, d.alpha * w * (0.8 + 0.7 * B) * (0.8 + 0.2 * p.depth));
          ctx.drawImage(dustSprite, p.px - s / 2, p.py - s / 2, s, s);
        }

        // 伴星。产品上的七颗星盖上来之后，这三颗画面伴星让开。
        if (this.spawnStart !== null && !this.covered) {
          for (const c of COMPANIONS) {
            let p;
            if (!settled) {
              p = this.settlePolar(this.spiralPolar(c.parent, 1), c.id, c.r, sp);
            } else {
              p = { r: c.r, a: this.orbitAngle(c.id, c.r) };
            }
            const pp = this.project(p.r, p.a);
            const born = clamp(sp / 0.35);
            const tw = 1 - 0.18 * (0.5 - 0.5 * Math.cos(twinkleT * 1.7 + c.r * 9));
            const d = 9 * (1 + 0.1 * pp.depth) * (1 + 0.6 * (1 - born));
            ctx.globalAlpha = Math.min(1, born * tw * (0.85 + 0.15 * B));
            ctx.drawImage(memberSprite, pp.px - d / 2, pp.py - d / 2, d, d);
          }
        }

        // 聊天生出的新星
        for (const s of this.grown) {
          const pp = this.project(s.r, s.a0 + this.omega(s.r) * this.clock);
          const fade = s.born === -Infinity ? 1 : easeInOut(clamp((this.clock - s.born) / 12));
          if (fade <= 0) continue;
          const tw = 1 - 0.25 * (0.5 - 0.5 * Math.cos(twinkleT * s.tw + s.tp));
          const d = (4 + 4 * s.size) * (1 + 0.1 * pp.depth);
          ctx.globalAlpha = Math.min(1, s.alpha * fade * tw * (0.75 + 0.35 * B));
          ctx.drawImage(s.spr, pp.px - d / 2, pp.py - d / 2, d, d);
        }

        // 三颗星的光尾
        for (const key in this.trails) {
          const t = this.trails[key], n = t.length;
          for (let i = 0; i < n; i++) {
            const q = i / n, d = 2 + q * 3;
            ctx.globalAlpha = q * q * 0.4;
            ctx.drawImage(memberSprite, t[i].x - d / 2, t[i].y - d / 2, d, d);
          }
        }

        // 分裂时的闪光
        const now = env.now();
        this.flashes = this.flashes.filter((f) => {
          const q = (now - f.t0) / 900;
          if (q >= 1) return false;
          const rad = 4 + 18 * easeOut(q);
          const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
          gr.addColorStop(0, `rgba(240,244,255,${0.45 * (1 - q)})`);
          gr.addColorStop(1, 'rgba(200,215,255,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, TAU); ctx.fill();
          return true;
        });

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      },
    };

    chats.forEach((h) => g.addChat(h, true));
    return g;
  };
})();
