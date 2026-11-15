// Paint engine for the plates. It draws on a raster buffer with dry art tools.
// All coordinates are in units. The canvas is 1000 units wide.
// The engine has no Node imports: the browser uses it for the draw-in animation.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const sm = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Color at position t on a list of color stops.
export function ramp(stops, t) {
  const u = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(u));
  return mix(stops[i], stops[i + 1], u - i);
}

// Small random change of value and hue. Each stick of pastel is a little different.
export function tint(c, R, amt) {
  const v = 1 + R.gauss() * amt;
  return [clamp(c[0] * v + R.gauss() * amt * 0.5), clamp(c[1] * v + R.gauss() * amt * 0.5), clamp(c[2] * v + R.gauss() * amt * 0.5)];
}

// Seeded generator. The same seed gives the same plate.
export function rng(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Start the sequence again. A scene does this at each section: then all hours get the same layout.
  f.seed = (n) => {
    s = n >>> 0;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.pick = (list) => list[Math.floor(f() * list.length)];
  f.gauss = () => (f() + f() + f() + f() - 2) / 1.16;
  return f;
}

function h2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function vnoise(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, seed);
  const b = h2(ix + 1, iy, seed);
  const c = h2(ix, iy + 1, seed);
  const d = h2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x, y, seed = 0, oct = 3) {
  let sum = 0;
  let w = 0.5;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    sum += w * vnoise(x, y, seed + i * 131);
    n += w;
    x *= 2.03;
    y *= 2.03;
    w *= 0.5;
  }
  return sum / n;
}

// Catmull-Rom curve through the control points.
export function spline(ctrl, res = 12) {
  const out = [];
  const p = (i) => ctrl[clamp(i, 0, ctrl.length - 1)];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const [a, b, c, d] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    for (let k = 0; k < res; k++) {
      const t = k / res;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((m) => 0.5 * (2 * b[m] + (c[m] - a[m]) * t + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * t2 + (3 * b[m] - a[m] - 3 * c[m] + d[m]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export function offsetPath(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / l) * d, p[1] + ((b[0] - a[0]) / l) * d];
  });
}

export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export function ellipse(cx, cy, rx, ry, rot = 0, n = 26) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
}

// Each tool has its own grain, streak, pressure loss, edge and opacity.
const TOOLS = {
  // Side of a pastel stick. Broad block-in marks for the underpainting. It covers the tooth.
  block: { grain: 0.75, streak: 0.5, dry: 0.1, contrast: 3.4, opacity: 0.96, attack: 3, release: 5, edge: 0.5, bw: 2.2, wvar: 0.22, thr: 0.36, cap: 0.9 },
  // Dry gouache on a flat brush. Bristle streaks. The paint goes away along the stroke.
  dryBrush: { grain: 0.5, streak: 0.8, dry: 0.55, contrast: 7, opacity: 0.97, attack: 5, release: 34, edge: 0.35, bw: 1.15, wvar: 0.12, thr: 0.56, cap: 0.45 },
  // Soft pastel. The paper tooth controls the mark. Powder edge.
  softPastel: { grain: 1.05, streak: 0.2, dry: 0.12, contrast: 3.2, opacity: 0.9, attack: 3, release: 6, edge: 0.6, bw: 2.4, wvar: 0.18, thr: 0.5 },
  // Colored pencil. Thin line with a taper and light pressure.
  pencil: { grain: 0.8, streak: 0.05, dry: 0.05, contrast: 3.2, opacity: 0.84, attack: 4, release: 6, edge: 0.75, bw: 2, wvar: 0.22, thr: 0.42, taper: 0.5 },
  // Charcoal. Dark, rough, with dust near the line.
  charcoal: { grain: 0.95, streak: 0.3, dry: 0.18, contrast: 4.5, opacity: 0.94, attack: 3, release: 7, edge: 0.5, bw: 1.6, wvar: 0.25, thr: 0.5, dust: 0.5 },
  // Oil pastel. Thick wax. It covers the tooth almost fully.
  oilPastel: { grain: 0.3, streak: 0.25, dry: 0.08, contrast: 9, opacity: 1, attack: 2, release: 4, edge: 0.3, bw: 1.8, wvar: 0.2, thr: 0.5 },
  // Very broad flat brush. It covers the old picture before a new picture starts.
  wash: { grain: 0.3, streak: 0.62, dry: 0.3, contrast: 4.2, opacity: 0.97, attack: 10, release: 46, edge: 0.4, bw: 3.4, wvar: 0.08, thr: 0.34, cap: 0.5 },
};

const TILE = 64;

// A canvas shows a window of the scene. The window is x0..x1 and y0..y1 in units. S is pixels for each unit.
// With "under", the canvas is a clear layer above a different canvas: the page shows the two together.
export class Canvas {
  constructor(width, height, { seed = 1, paper = "#aebbd4", view = null, tooth = null, under = null } = {}) {
    const v = view ?? { x0: 0, y0: 0, S: width / 1000 };
    this.W = width;
    this.H = height;
    this.S = v.S;
    this.x0 = v.x0;
    this.y0 = v.y0;
    this.x1 = v.x0 + width / v.S;
    this.y1 = v.y0 + height / v.S;
    this.R = rng(seed);
    this.paper = hex(paper);
    this.rgb = new Float32Array(width * height * 3);
    this.a = new Float32Array(width * height);
    this.under = under;
    // depth holds the layer of the last mark at each pixel. A mark with "keep" does not go above a higher layer.
    this.depth = under ? under.depth : new Uint8Array(width * height);
    this.layer = 0;
    // Default "keep" for all marks. -1 is no limit.
    this.keep = -1;
    // Marks of one hatch or one scumble are a field. The order in a field is free.
    this.field = 0;
    this.fields = 0;
    this.count = 0;
    // With a queue, marks are recorded in stroke order and painted later.
    this.queue = null;
    this.tw = Math.ceil(width / TILE);
    this.th = Math.ceil(height / TILE);
    // Tiles that changed since the last flush.
    this.tiles = new Uint8Array(this.tw * this.th);
    this.boxes = under ? [] : null;
    this.tooth = tooth ?? under?.tooth ?? this.makeTooth(7);
  }

  // Show a different window of the scene. The pixels stay.
  setView(v) {
    this.S = v.S;
    this.x0 = v.x0;
    this.y0 = v.y0;
    this.x1 = v.x0 + this.W / v.S;
    this.y1 = v.y0 + this.H / v.S;
  }

  // Paper tooth: coarse grain, fine grain and faint laid lines.
  makeTooth(seed) {
    const { W, H, S } = this;
    const tooth = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const v = y / S;
      const laid = 0.05 * Math.sin(v * 1.9);
      for (let x = 0; x < W; x++) {
        const u = x / S;
        const t = 0.5 * vnoise(u / 2.3, v / 2.3, seed) + 0.3 * vnoise(u / 0.85, v / 0.85, seed + 1) + 0.2 * vnoise(u / 8, v / 5, seed + 2) + laid;
        tooth[y * W + x] = clamp(0.5 + (t - 0.5) * 2.3);
      }
    }
    return tooth;
  }

  // Hand line: a slow wobble and a small bow.
  line(x0, y0, x1, y1, wob = 1.2) {
    const R = this.R;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const n = Math.max(3, Math.ceil(len / 12));
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const sd = Math.floor(R() * 1e6);
    const bow = (R() - 0.5) * 2 * wob * Math.min(1, len / 160);
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const o = (vnoise((t * len) / 42, 0.5, sd) - 0.5) * 2 * wob + bow * Math.sin(Math.PI * t);
      out.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
    }
    return out;
  }

  wobble(pts, amp = 1) {
    const sd = Math.floor(this.R() * 1e6);
    return pts.map(([x, y], i) => [x + (vnoise(i / 3.5, 1.5, sd) - 0.5) * 2 * amp, y + (vnoise(i / 3.5, 7.5, sd) - 0.5) * 2 * amp]);
  }

  // Run a mark now, or record it for the timeline.
  // weight: share of the paint time. span: seconds for the hand to make the mark. box: pixels the mark can touch.
  mark(m) {
    if (this.queue) this.queue.push(m);
    else m.paint(1);
  }

  touch(x0, y0, x1, y1) {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(this.W, Math.ceil(x1));
    y1 = Math.min(this.H, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    if (this.boxes) this.boxes.push([x0, y0, x1, y1]);
    this.flag(x0, y0, x1, y1);
  }

  flag(x0, y0, x1, y1) {
    const tx1 = Math.min(this.tw - 1, (x1 - 1) >> 6);
    const ty1 = Math.min(this.th - 1, (y1 - 1) >> 6);
    for (let ty = y0 >> 6; ty <= ty1; ty++) for (let tx = x0 >> 6; tx <= tx1; tx++) this.tiles[ty * this.tw + tx] = 1;
  }

  // Call fn(x, y, w, h) for each run of changed tiles, on this canvas or on the layer above it. Then clear the flags.
  flush(fn, over = null) {
    const { tw, th, tiles, W, H } = this;
    for (let ty = 0; ty < th; ty++) {
      let run = -1;
      for (let tx = 0; tx <= tw; tx++) {
        const i = ty * tw + tx;
        const on = tx < tw && (tiles[i] || (over && over.tiles[i]));
        if (on) {
          if (run < 0) run = tx;
          tiles[i] = 0;
          if (over) over.tiles[i] = 0;
        } else if (run >= 0) {
          const x = run * TILE;
          const y = ty * TILE;
          fn(x, y, Math.min(W, tx * TILE) - x, Math.min(H, y + TILE) - y);
          run = -1;
        }
      }
    }
  }

  // Remove all marks of a clear layer. The canvas below shows again.
  wipe() {
    const { W, rgb, a } = this;
    for (const [x0, y0, x1, y1] of this.boxes) {
      for (let y = y0; y < y1; y++) {
        a.fill(0, y * W + x0, y * W + x1);
        rgb.fill(0, (y * W + x0) * 3, (y * W + x1) * 3);
      }
      this.flag(x0, y0, x1, y1);
    }
    this.boxes.length = 0;
  }

  stroke(pts, o) {
    const { S, x0, y0, W, H } = this;
    const n = pts.length;
    if (n < 2) return;
    const X = new Float64Array(n);
    const Y = new Float64Array(n);
    const cum = new Float64Array(n);
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = (X[i] = (pts[i][0] - x0) * S);
      const y = (Y[i] = (pts[i][1] - y0) * S);
      if (i) cum[i] = cum[i - 1] + Math.hypot(x - X[i - 1], y - Y[i - 1]);
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
    const L = cum[n - 1];
    // The seed is taken now. Then a recorded mark is the same as an immediate mark.
    const seed = Math.floor(this.R() * 2 ** 30);
    const pad = o.width * S * 0.65 + 2;
    if (L < 0.5 || bx1 + pad < 0 || by1 + pad < 0 || bx0 - pad > W || by0 - pad > H) return;
    const TX = new Float64Array(n);
    const TY = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = Math.max(0, i - 1);
      const q = Math.min(n - 1, i + 1);
      const l = Math.hypot(X[q] - X[p], Y[q] - Y[p]) || 1;
      TX[i] = (X[q] - X[p]) / l;
      TY[i] = (Y[q] - Y[p]) / l;
    }
    const lenU = L / S;
    const g = { X, Y, cum, TX, TY, L, seed, o, layer: this.layer, i: 0, seg: 0, modv: 1, bArr: null };
    this.mark({
      weight: Math.sqrt(L * o.width * S) + 3,
      // Long marks of a field take time. Marks of an object are instant: a later mark does not wait.
      span: o.span ?? (this.field && lenU > 90 ? lenU / 1500 : 0),
      field: this.field,
      layer: this.layer,
      o,
      box: [bx0 - pad, by0 - pad, bx1 + pad, by1 + pad],
      paint: (p) => this.paintStroke(g, p),
    });
  }

  // Paint a stroke up to part p of its length. A long stroke takes more than one frame.
  paintStroke(g, p) {
    const { W, H, S, rgb, a: alpha, tooth, depth } = this;
    const { X, Y, cum, TX, TY, L, seed, o, layer } = g;
    const n = X.length;
    const { color, width, mod } = o;
    const press = o.press ?? 1;
    const taper = o.taper ?? 0;
    const keep = o.keep ?? this.keep;
    const stamp = !this.under;
    const lenU = L / S;
    const attack = Math.min(o.attack, lenU * 0.4) / lenU;
    const release = Math.min(o.release, lenU * 0.45) / lenU;
    const half0 = (width * S) / 2;
    const nb = Math.max(1, Math.ceil(half0 / 0.8));
    const [cr, cg, cb] = color;
    const steps = Math.ceil(L / 0.8);
    const lim = p >= 1 ? steps : Math.floor(steps * p);
    if (!g.bArr) {
      g.bArr = new Float32Array(2 * nb + 1);
      this.count++;
    }
    const bArr = g.bArr;
    let { seg, modv } = g;
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (let i = g.i; i <= lim; i++) {
      const s = Math.min(L, i * 0.8);
      while (seg < n - 2 && s > cum[seg + 1]) seg++;
      const f = (s - cum[seg]) / (cum[seg + 1] - cum[seg] || 1);
      const x = X[seg] + (X[seg + 1] - X[seg]) * f;
      const y = Y[seg] + (Y[seg + 1] - Y[seg]) * f;
      let tx = TX[seg] + (TX[seg + 1] - TX[seg]) * f;
      let ty = TY[seg] + (TY[seg + 1] - TY[seg]) * f;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const t = s / L;
      const su = s / S;
      if (i % 6 === 0) {
        for (let j = -nb; j <= nb; j++) {
          const bu = (j * 0.8) / S;
          bArr[j + nb] = 0.6 * vnoise(bu / o.bw + 17.3, su / 70, seed) + 0.4 * vnoise(bu / (o.bw * 4.2) + 91.7, su / 170, seed + 7);
        }
        if (mod) modv = mod(x / S + this.x0, y / S + this.y0);
      }
      const env = sm(0, attack, t) * sm(0, release, 1 - t);
      const load = 1 - o.dry * Math.pow(t, 1.4);
      const pw = press * (0.82 + 0.36 * vnoise(su / 80, 3.7, seed + 3));
      const base = env * load * pw * modv;
      if (base < 0.12) continue;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
      // Round the two ends of the mark.
      const e = Math.min(s, L - s) / half0;
      const cap = e < 1 ? 1 - (o.cap ?? 1) * (1 - Math.sqrt(1 - (1 - e) * (1 - e))) : 1;
      const half = half0 * cap * (1 - o.wvar + 2 * o.wvar * vnoise(su / 60, 9.1, seed + 5)) * (1 - taper * (1 - env));
      const nbh = Math.max(1, Math.ceil(half / 0.8));
      for (let j = -nbh; j <= nbh; j++) {
        const u = j / nbh;
        const px = x - ty * u * half;
        const py = y + tx * u * half;
        if (px < 0 || py < 0) continue;
        const ix = px | 0;
        const iy = py | 0;
        if (ix >= W || iy >= H) continue;
        const k = iy * W + ix;
        if (keep >= 0 && depth[k] > keep) continue;
        const jb = Math.round((u * half) / 0.8) + nb;
        const u2 = u * u;
        const v = base * (1 - o.edge * u2 * u2) + (bArr[clamp(jb, 0, 2 * nb)] - 0.5) * o.streak * 1.6 + (tooth[k] - 0.5) * o.grain * 1.4;
        let a = (v - o.thr) * o.contrast;
        if (a <= 0) continue;
        if (a > 1) a = 1;
        a *= o.opacity;
        const q = 1 - a;
        const k3 = k * 3;
        rgb[k3] = rgb[k3] * q + cr * a;
        rgb[k3 + 1] = rgb[k3 + 1] * q + cg * a;
        rgb[k3 + 2] = rgb[k3 + 2] * q + cb * a;
        alpha[k] = alpha[k] * q + a;
        if (stamp && a > 0.25) depth[k] = layer;
      }
    }
    g.i = lim + 1;
    g.seg = seg;
    g.modv = modv;
    const pad = half0 * 1.3 + 2;
    if (bx1 >= bx0) this.touch(bx0 - pad, by0 - pad, bx1 + pad, by1 + pad);
  }

  tool(name, pts, color, width, opts = {}) {
    const t = TOOLS[name];
    this.stroke(pts, { ...t, name, color, width, ...opts });
    // Charcoal dust: a few specks near the line.
    if (t.dust && width > 3) {
      const R = this.R;
      const nDust = Math.floor(pts.length * t.dust * R());
      for (let i = 0; i < nDust; i++) {
        const p = R.pick(pts);
        this.dot(p[0] + R.gauss() * width * 1.1, p[1] + R.gauss() * width * 1.1, R.range(0.4, 1), color, { press: 0.7, keep: opts.keep ?? this.keep });
      }
    }
  }

  dryBrush(pts, color, width, opts) {
    this.tool("dryBrush", pts, color, width, opts);
  }
  softPastel(pts, color, width, opts) {
    this.tool("softPastel", pts, color, width, opts);
  }
  pencil(pts, color, width, opts) {
    this.tool("pencil", pts, color, width, opts);
  }
  charcoal(pts, color, width, opts) {
    this.tool("charcoal", pts, color, width, opts);
  }
  oilPastel(pts, color, width, opts) {
    this.tool("oilPastel", pts, color, width, opts);
  }

  // One pressed mark. The edge follows the paper tooth.
  dot(x, y, r, color, { press = 1, grain = 0.5, opacity = 1, keep = this.keep } = {}) {
    const R = this.R;
    const sq = R.range(0.8, 1.25);
    const ang = R() * Math.PI;
    const rp = r * this.S;
    const cx = (x - this.x0) * this.S;
    const cy = (y - this.y0) * this.S;
    const ext = rp * 1.4 + 2;
    if (cx + ext < 0 || cy + ext < 0 || cx - ext > this.W || cy - ext > this.H) return;
    const layer = this.layer;
    const o = { keep };
    this.mark({
      weight: rp + 3,
      span: 0,
      field: this.field,
      layer,
      o,
      box: [cx - ext, cy - ext, cx + ext, cy + ext],
      paint: () => this.paintDot(cx, cy, rp, color, press, grain, opacity, sq, ang, layer, o.keep ?? this.keep),
    });
  }

  paintDot(cx, cy, rp, color, press, grain, opacity, sq, ang, layer, keep) {
    const { W, H, rgb, a: alpha, tooth, depth } = this;
    const stamp = !this.under;
    this.touch(cx - rp * 1.4 - 2, cy - rp * 1.4 - 2, cx + rp * 1.4 + 2, cy + rp * 1.4 + 2);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const ext = Math.ceil(rp * 1.4);
    for (let iy = Math.floor(cy - ext); iy <= cy + ext; iy++) {
      for (let ix = Math.floor(cx - ext); ix <= cx + ext; ix++) {
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        const dx = ix + 0.5 - cx;
        const dy = iy + 0.5 - cy;
        const d = Math.hypot((dx * ca + dy * sa) * sq, (-dx * sa + dy * ca) / sq) / rp;
        if (d > 1.3) continue;
        const k = iy * W + ix;
        if (keep >= 0 && depth[k] > keep) continue;
        let a = (press * (1.25 - d * d) + (tooth[k] - 0.5) * grain * 1.2 - 0.5) * 5;
        if (a <= 0) continue;
        if (a > 1) a = 1;
        a *= opacity;
        const q = 1 - a;
        const k3 = k * 3;
        rgb[k3] = rgb[k3] * q + color[0] * a;
        rgb[k3 + 1] = rgb[k3 + 1] * q + color[1] * a;
        rgb[k3 + 2] = rgb[k3 + 2] * q + color[2] * a;
        alpha[k] = alpha[k] * q + a;
        if (stamp && a > 0.25) depth[k] = layer;
      }
    }
  }

  // Marks made in fn are one field: the timeline can paint them in any order.
  group(fn) {
    const outer = this.field;
    this.field = ++this.fields;
    fn();
    this.field = outer;
  }

  // Fill a shape with many strokes in one direction. Strokes overshoot, stop short and leave gaps.
  hatch(poly, tool, color, o = {}) {
    const R = this.R;
    const { angle = 0, width = 12, maxLen = 260, wob = 1.2, jitter = 0.03, press = 1, mod = null, skip = 0.03, cj = 0, opts = {} } = o;
    const spacing = o.spacing ?? width * 0.6;
    const over = o.over ?? [-2, 6];
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const rp = poly.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of rp) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    const outer = this.field;
    this.field = ++this.fields;
    for (let y = y0 + R() * spacing; y < y1; y += spacing * R.range(0.72, 1.28)) {
      const xs = [];
      for (let i = 0; i < rp.length; i++) {
        const a = rp[i];
        const b = rp[(i + 1) % rp.length];
        if (a[1] <= y !== b[1] <= y) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const end = xs[i + 1] + R.range(over[0], over[1]);
        let p = xs[i] - R.range(over[0], over[1]);
        while (end - p > 1.5) {
          const len = Math.min(end - p, maxLen * R.range(0.5, 1));
          const q = p + len;
          if (R() > skip) {
            const yy = y + R.range(-0.25, 0.25) * spacing;
            const tilt = R.range(-jitter, jitter) * len * 0.5;
            const ax = p * c - (yy - tilt) * s;
            const ay = p * s + (yy - tilt) * c;
            const bx = q * c - (yy + tilt) * s;
            const by = q * s + (yy + tilt) * c;
            let go = true;
            if (mod) go = Math.max(mod(ax, ay), mod((ax + bx) / 2, (ay + by) / 2), mod(bx, by), mod(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25), mod(ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75)) > 0.2;
            if (go) {
              const flip = R() < 0.5;
              const pts = flip ? this.line(bx, by, ax, ay, wob) : this.line(ax, ay, bx, by, wob);
              let c = typeof color === "function" ? color((ax + bx) / 2, (ay + by) / 2) : color;
              if (cj) c = tint(c, R, cj);
              this.tool(tool, pts, c, width * R.range(0.82, 1.18), { ...opts, press: press * R.range(0.86, 1.1), mod });
            }
          }
          p = q - R() * Math.min(len * 0.2, 10);
          if (q >= end) break;
        }
      }
    }
    this.field = outer;
  }

  // Cover an area with many short marks on a loose grid.
  // color, angle and mask can be functions of the position. The area is cut to the window.
  scumble(box, tool, o) {
    const R = this.R;
    const { len = [40, 80], width = [4, 7], gap = 1.2, lap = 0.7, mask = null, press = 1, jitter = 0.12, cj = 0.03, wob = 1, opts = {} } = o;
    const cell = Math.sqrt(((len[0] + len[1]) / 2) * lap * ((width[0] + width[1]) / 2) * gap);
    const pad = len[1] / 2 + cell;
    // Cells are counted from the box corner. Then the same box gives the same marks at all window sizes.
    const [x0, y0, x1, y1] = box;
    const outer = this.field;
    this.field = ++this.fields;
    for (let gy = y0; gy < y1; gy += cell) {
      const rowOut = gy + cell < this.y0 - pad || gy > this.y1 + pad;
      for (let gx = x0; gx < x1; gx += cell) {
        if (rowOut || gx + cell < this.x0 - pad || gx > this.x1 + pad) continue;
        const x = gx + R() * cell;
        const y = gy + R() * cell;
        if (mask) {
          const m = mask(x, y);
          if (m <= 0.02 || R() > m * 1.3) continue;
        }
        const a = (typeof o.angle === "function" ? o.angle(x, y) : (o.angle ?? 0)) + R.range(-jitter, jitter);
        const l = R.range(len[0], len[1]) / 2;
        const c = typeof o.color === "function" ? o.color(x, y) : o.color;
        const dx = Math.cos(a) * l;
        const dy = Math.sin(a) * l;
        this.tool(tool, this.line(x - dx, y - dy, x + dx, y + dy, wob), cj ? tint(c, R, cj) : c, R.range(width[0], width[1]), { ...opts, press: press * R.range(0.85, 1.1) });
      }
    }
    this.field = outer;
  }

  // Part of the paper with no pigment.
  bare() {
    let n = 0;
    for (let i = 0; i < this.a.length; i++) if (this.a[i] < 0.2) n++;
    return n / this.a.length;
  }

  // Pixel bytes of one box: pigment on paper, with the shade of the paper tooth.
  // over is a clear layer above this canvas. noise adds a small random change to each pixel. channels is 3 or 4.
  pixels(x0 = 0, y0 = 0, w = this.W, h = this.H, channels = 4, noise = null, over = null) {
    const { W, rgb, a, tooth, paper } = this;
    const out = new Uint8ClampedArray(w * h * channels);
    const top = over ? over.rgb : null;
    const ta = over ? over.a : null;
    let o = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const k = y * W + x;
        const k3 = k * 3;
        const shade = (1 + (tooth[k] - 0.5) * 0.05 + (noise ? (noise() - 0.5) * 0.012 : 0)) * 255;
        const q = 1 - a[k];
        let r = rgb[k3] + paper[0] * q;
        let g = rgb[k3 + 1] + paper[1] * q;
        let b = rgb[k3 + 2] + paper[2] * q;
        if (ta && ta[k] > 0) {
          const tq = 1 - ta[k];
          r = r * tq + top[k3];
          g = g * tq + top[k3 + 1];
          b = b * tq + top[k3 + 2];
        }
        out[o] = r * shade;
        out[o + 1] = g * shade;
        out[o + 2] = b * shade;
        if (channels === 4) out[o + 3] = 255;
        o += channels;
      }
    }
    return out;
  }
}

// Fit the frame of a scene to a canvas of W x H pixels.
// The frame is the part of the scene that must show. A wider canvas shows more at the two sides.
// A taller canvas shows more sky.
export function fitView(frame, W, H) {
  const { w = 1000, cx = 500, top = 400, bottom = 1333 } = frame ?? {};
  const S = Math.min(W / w, H / (bottom - top));
  return { x0: cx - W / S / 2, y0: bottom - H / S, S };
}
