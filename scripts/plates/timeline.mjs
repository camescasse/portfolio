// Order and time of the marks. The page and the render script use the same timeline.
// A new place: broad wash strokes go across the old picture, and the new picture follows the wash.
// A new hour: no wash. The new tones go over the old picture, part by part.
import { fbm, rng, tint } from "./engine.mjs";

const DIRS = [[1, 0.3], [-1, 0.3], [0.3, 1], [1, -0.3], [-1, -0.3]];
const CELL = 40;

// Broad strokes in the colors of the new sky and ground. They cover the old picture.
export function washMarks(cv, S, turn) {
  const R = rng(1700 + turn);
  const outer = cv.queue;
  cv.queue = [];
  cv.layer = 0;
  const field = cv.field;
  cv.field = ++cv.fields;
  const [stepX, stepY] = [310, 104];
  for (let y = cv.y0 - 20, row = 0; y < cv.y1 + stepY * 0.6; y += stepY, row++) {
    for (let x = cv.x0 - 120 - ((row % 2) * stepX) / 2; x < cv.x1 + 200; x += stepX) {
      const cx = x + (R() - 0.5) * 70;
      const cy = y + (R() - 0.5) * 30;
      const ang = (R() - 0.5) * 0.22 - 0.06;
      const color = S.washAt(cx, cy);
      // Two passes. The second pass goes between the bristle marks of the first.
      for (let pass = 0; pass < 2; pass++) {
        const l = R.range(190, 235);
        const a = ang + (R() - 0.5) * 0.07;
        const off = pass * 14 + (R() - 0.5) * 16;
        const [dx, dy] = [Math.cos(a) * l, Math.sin(a) * l];
        const flip = R() < 0.5 ? -1 : 1;
        cv.tool("wash", cv.line(cx - dx * flip, cy - dy * flip + off, cx + dx * flip, cy + dy * flip + off, 5), tint(color, R, 0.02), R.range(138, 168), { span: R.range(0.3, 0.42), press: R.range(0.95, 1.1) });
      }
    }
  }
  const marks = cv.queue;
  cv.queue = outer;
  cv.field = field;
  return marks;
}

// Give each mark a start time T.
// sweep: part of the time that the hand takes to go across the picture. 0 paints layer by layer.
// jitter: how ragged the front of the sweep is.
// scatter: how far single marks go in front of the sweep.
export function schedule(cv, marks, { dur, wash = null, turn = 0, sweep = 0.4, jitter = 0.12, scatter = 0, washPart = 0.32, lead = 0.12 }) {
  const { W, H } = cv;
  const [ax, ay] = DIRS[turn % DIRS.length];
  const corners = [0, W * ax, H * ay, W * ax + H * ay];
  const lo = Math.min(...corners);
  const hi = Math.max(...corners);
  const noise = W * 0.22;
  const place = (m, k) => {
    const cx = (m.box[0] + m.box[2]) / 2;
    const cy = (m.box[1] + m.box[3]) / 2;
    const u = (cx * ax + cy * ay - lo) / (hi - lo) + k * (fbm(cx / noise, cy / noise, 91 + turn, 2) - 0.5) * 2;
    m.u = u < 0 ? 0 : u > 1 ? 1 : u;
  };
  const chance = rng(300 + turn);
  for (const m of marks) {
    place(m, jitter);
    if (scatter) m.u = Math.min(1, Math.max(0, m.u + (chance() - 0.5) * scatter));
  }
  // In a field, the hand goes along the sweep.
  for (let i = 0; i < marks.length; ) {
    let j = i + 1;
    if (marks[i].field) {
      while (j < marks.length && marks[j].field === marks[i].field) j++;
      if (j - i > 2) {
        const run = marks.slice(i, j).sort((p, q) => p.u - q.u);
        for (let k = 0; k < run.length; k++) marks[i + k] = run[k];
      }
    }
    i = j;
  }
  let total = 0;
  for (const m of marks) total += m.weight;
  const start = wash ? dur * lead : 0;
  const tSweep = (dur - start) * sweep;
  const tLayers = (dur - start) * (1 - sweep);
  let cum = 0;
  for (const m of marks) {
    m.T = start + (tLayers * cum) / total + tSweep * m.u;
    cum += m.weight;
  }
  const all = [];
  if (wash) {
    for (const m of wash) {
      place(m, 0.03);
      m.T = dur * washPart * m.u;
      all.push(m);
    }
    all.sort((p, q) => p.T - q.T);
  }
  for (const m of marks) all.push(m);
  // A mark waits for the marks below it. Each cell holds the end time of the marks of earlier fields.
  // Marks of one field do not wait for each other.
  const gw = Math.ceil(W / CELL);
  const gh = Math.ceil(H / CELL);
  const below = new Float32Array(gw * gh);
  const own = new Float32Array(gw * gh);
  const owner = new Int32Array(gw * gh);
  for (const m of all) {
    const x0 = Math.max(0, Math.floor(m.box[0] / CELL));
    const y0 = Math.max(0, Math.floor(m.box[1] / CELL));
    const x1 = Math.min(gw - 1, Math.floor(m.box[2] / CELL));
    const y1 = Math.min(gh - 1, Math.floor(m.box[3] / CELL));
    let T = m.T;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = y * gw + x;
        if (!m.field || owner[c] !== m.field) {
          if (own[c] > below[c]) below[c] = own[c];
          own[c] = 0;
          owner[c] = m.field;
        }
        if (below[c] > T) T = below[c];
      }
    }
    m.T = T;
    const end = T + m.span;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (end > own[y * gw + x]) own[y * gw + x] = end;
  }
  // The waits make the timeline longer. Bring it back to the asked time.
  let last = 0;
  for (const m of all) if (m.T > last) last = m.T;
  if (last > dur * 0.97) for (const m of all) m.T *= (dur * 0.97) / last;
  // Marks keep their order when the times are equal.
  all.forEach((m, i) => (m.n = i));
  return all.sort((p, q) => p.T - q.T || p.n - q.n);
}

// Paints the marks of a timeline as the time goes on.
export class Player {
  constructor(items) {
    this.items = items;
    this.i = 0;
    this.active = [];
    this.t = 0;
  }

  get done() {
    return this.i >= this.items.length && !this.active.length;
  }

  // budget: milliseconds for this step. With too much work, the clock waits for the hand.
  step(dt, budget = Infinity) {
    const { items } = this;
    const t = (this.t += dt);
    const stop = budget === Infinity ? Infinity : performance.now() + budget;
    // Long strokes continue.
    this.active = this.active.filter((m) => {
      const p = (t - m.T) / m.span;
      m.paint(p);
      return p < 1;
    });
    let n = 0;
    while (this.i < items.length && items[this.i].T <= t) {
      const m = items[this.i++];
      if (m.span > 0) {
        const p = (t - m.T) / m.span;
        m.paint(p);
        if (p < 1) this.active.push(m);
      } else m.paint(1);
      if (++n % 16 === 0 && performance.now() > stop) {
        this.t = m.T;
        break;
      }
    }
  }

  finish() {
    for (const m of this.active) m.paint(1);
    this.active = [];
    for (; this.i < this.items.length; this.i++) this.items[this.i].paint(1);
  }
}

// Record a scene and make its timeline.
// kind "coat": a new place, with a wash. kind "tone": a new hour of the same place.
export function transition(cv, scene, hour, { kind = "coat", dur = 7.5, turn = 0 } = {}) {
  cv.queue = [];
  const S = scene.draw(cv, hour);
  const marks = cv.queue;
  const wash = kind === "coat" ? washMarks(cv, S, turn) : null;
  cv.queue = null;
  // A new hour: the block-in is a thin layer. The old picture shows through it, and the new tones go over the two.
  // A mark does not go across the things in front of its layer: boats and trees stay until their own marks come.
  if (kind === "tone") {
    for (const m of marks) {
      if (m.o.name === "block") m.o.opacity = 0.7;
      if (m.o.keep === undefined || m.o.keep < 0) m.o.keep = m.layer;
    }
  }
  const items = dur > 0 ? schedule(cv, marks, kind === "coat" ? { dur, wash, turn, sweep: 0.42, jitter: 0.1 } : { dur, turn, sweep: 0.7, jitter: 0.34, scatter: 0.3 }) : marks;
  return { S, player: new Player(items) };
}

// Things that move. They are painted again on the clear layer each frame.
export function drawSprites(ov, S, t) {
  ov.wipe();
  for (const sprite of S.sprites) {
    // The same strokes each frame, at a different position.
    ov.R.seed(sprite.seed * 977);
    ov.keep = sprite.keep ?? -1;
    sprite.draw(ov, t);
  }
}

// New marks on the picture itself, for example on water.
export function runLive(S, t, dt) {
  for (const live of S.live) live(t, dt);
}
