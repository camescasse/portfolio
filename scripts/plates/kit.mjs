// Shared parts for the scenes: palettes, sky, sea, land, boats, birds.
// Look: dense pastel. Block-in first, then layers of short hatch marks, then small details.
//
// Window: a scene has a frame of 1000 x 1333 units. The canvas can show more than the frame.
// S.x0..S.x1 is the width to paint. S.top is the top of the sky. S.bottom is the lower edge.
// Layers: 0 wash, 1 sky, 2 far land, 3 sea, 4 and up for all other things.
// Hours: a part that uses random numbers in a different way at night must call S.cut() at its end.
// Then day, dusk and night have the same layout.
import { clamp, ellipse, fbm, hex, mix, offsetPath, ramp, rect, rng, sm, spline, tint, vnoise } from "./engine.mjs";

export const HOURS = ["day", "dusk", "night"];
// Toned pastel paper. The marks cover it.
export const PAPER = { day: "#aebbd4", dusk: "#8a7ca8", night: "#161c4c" };

// Peach, coral, teal, cobalt and indigo. Lists go from dark to light, or from far to near.
const PALETTES = {
  day: {
    sky: ["#2a4fb0", "#3f74d0", "#62a4e2", "#93cfe6", "#c8ead8", "#f8e6c6"],
    cloud: ["#3f58a8", "#5f78c8", "#8ea0de", "#c2c8ee", "#f6c9b4", "#fbe0c2", "#fff6e6"],
    sea: ["#24499a", "#2b78a8", "#36a8a8", "#62cdb8", "#a6e6cf"],
    land: ["#1c2f66", "#1f5f6e", "#2f8a70", "#6db572", "#c4dc8a"],
    sand: ["#d99a78", "#f0c49a", "#f9dfb8", "#fff2da"],
    wood: ["#4a3a6a", "#a8786e", "#e8b88c", "#f9dcb4"],
    wall: ["#fff0dc", "#f8d2b0", "#f1a78e", "#bfe3d8"],
    roof: ["#ee6650", "#2b78a8", "#34408e", "#f2b06a", "#8a4a5a"],
    ink: "#1a2152", hot: "#ee6650", sun: "#fff6d8", glow: "#fff3d0", lamp: "#ffd76a",
  },
  dusk: {
    sky: ["#2a2f80", "#4354b8", "#5f92cc", "#9ad2c8", "#fbdca4", "#f9ab86", "#ec6e60"],
    cloud: ["#2e3484", "#4d4ea6", "#7c68b4", "#c97a9a", "#f08a70", "#fbb888", "#ffe4a4"],
    sea: ["#2e3484", "#3b4a9c", "#3f6aa8", "#3f8aa8"],
    land: ["#141a4a", "#1f2a68", "#2a4a7c", "#3f7a8c", "#e08a70"],
    sand: ["#4a3f84", "#8a628c", "#d98c80", "#fbc49a"],
    wood: ["#22225e", "#5a4278", "#c97a7a", "#f8b48a"],
    wall: ["#6a5a9a", "#a878a0", "#e89a84", "#f8c49c"],
    roof: ["#2e3484", "#8a4a6a", "#3f6aa8", "#c96a6a"],
    ink: "#12163f", hot: "#f0745c", sun: "#fff0b8", glow: "#ffe9a8", lamp: "#ffd866",
  },
  night: {
    sky: ["#0c1034", "#141c52", "#1d2e78", "#27509a", "#3a84a8", "#62b4b4"],
    cloud: ["#10153f", "#1a2460", "#2a3a88", "#4a5cb0", "#7f8cd0", "#b8c2ea", "#eef0ff"],
    sea: ["#0e1440", "#162260", "#1f3a80", "#2a5a94"],
    land: ["#090c2a", "#0f163f", "#182a5c", "#2a4a7c", "#4a7aa0"],
    sand: ["#1a2052", "#2f3a78", "#5a68a8", "#8f9ad0"],
    wood: ["#0f143c", "#232d6e", "#4a5cb0", "#8f9ad0"],
    wall: ["#1f2a66", "#34408e", "#5a68a8", "#8f9ad0"],
    roof: ["#10153f", "#232d6e", "#2a4a7c", "#3f3a78"],
    ink: "#070922", hot: "#f08a5c", sun: "#fbf4dc", glow: "#dfe8ff", lamp: "#ffd866",
  },
};

function palette(hour) {
  return Object.fromEntries(Object.entries(PALETTES[hour]).map(([k, v]) => [k, Array.isArray(v) ? v.map(hex) : hex(v)]));
}

// Scene state: palette, light, and the color of the sky at each point.
// o: seed, yh (horizon), light [x, y], sun { x, y, r, moon }, refl (sky color in the sea).
export function scene(cv, hour, o) {
  const S = { cv, hour, R: cv.R, P: palette(hour), mirror: 1, glowR: 280, glowAmt: 0.7, cloudTone: hour === "night" ? -0.3 : hour === "dusk" ? -0.06 : 0, sprites: [], live: [], cuts: 0, ...o };
  if (hour === "night") Object.assign(S, { glowAmt: 0.4, glowR: 170 });
  const { P, yh } = S;
  cv.R.seed(S.seed);
  cv.layer = 1;
  S.x0 = cv.x0 - 30;
  S.x1 = cv.x1 + 30;
  S.top = cv.y0 - 30;
  S.bottom = cv.y1 + 30;
  S.night = hour === "night";
  // Start the random sequence again. All hours continue with the same numbers.
  S.cut = () => cv.R.seed(S.seed * 7919 + ++S.cuts * 104729);
  // A point in the sky that shows: fx and fy go from 0 to 1.
  S.sx = (fx) => cv.x0 + fx * (cv.x1 - cv.x0);
  S.sy = (fy) => cv.y0 + fy * (yh - cv.y0);
  // Size factor for things in the sky. A low sky gets small clouds.
  S.k = clamp((yh - cv.y0) / 800, 0.5, 1.25);
  const skyTop = Math.min(cv.y0, yh - 560);
  S.skyAt = (x, y) => {
    const c = ramp(P.sky, clamp((y - skyTop) / (yh - skyTop)) + (fbm(x / 260, y / 90, 5, 2) - 0.5) * 0.13);
    const d = Math.hypot((x - S.light[0]) / 1.7, y - S.light[1]);
    return mix(c, P.glow, S.glowAmt * Math.exp(-((d / S.glowR) ** 2)));
  };
  S.dark = (c, k) => mix(c, P.ink, k);
  S.lit = (c, k) => mix(c, P.glow, k);
  // Color of the broad wash that covers the old picture.
  S.washAt = (x, y) => (y < yh ? S.skyAt(x, y) : mix(S.skyAt(x, yh - 30), P.sea[1], 0.45 + 0.3 * clamp((y - yh) / 400)));
  return S;
}

// ---------------------------------------------------------------- Sky

// A cumulus cloud: towers of round puffs on a flat base.
export function makeCloud(R, { x, base, w, h, n = 12, sx = 1, seed = 1 }) {
  // Clouds stay small. The sky is the subject, not the cloud.
  w *= 0.74;
  h *= 0.56;
  const blobs = [];
  const towers = Math.max(2, Math.round(n / 4));
  const tall = Math.floor(R() * towers);
  for (let t = 0; t < towers; t++) {
    const cx = x + ((t + 0.5) / towers - 0.5) * w * 0.74 + R.gauss() * w * 0.04;
    const th = h * (t === tall ? 1 : R.range(0.38, 0.8));
    let r = (R.range(0.15, 0.21) * w) / sx;
    let y = base - r * 0.6;
    let px = cx;
    while (base - y < th && r > (w * 0.03) / sx) {
      blobs.push({ x: px, y, rx: r * sx, ry: r });
      // A smaller puff on the side of the tower.
      if (R() < 0.85) blobs.push({ x: px + (R() < 0.5 ? -1 : 1) * r * sx * R.range(0.7, 1.1), y: y + r * R.range(0.1, 0.5), rx: r * sx * 0.72, ry: r * 0.72 });
      px += R.gauss() * r * 0.4 * sx;
      y -= r * R.range(0.72, 1.0);
      r *= R.range(0.86, 0.98);
    }
  }
  for (let i = 0; i < n; i++) {
    const r = (R.range(0.07, 0.12) * w) / sx;
    blobs.push({ x: x + (R() - 0.5) * w, y: base - r * R.range(0.4, 0.9), rx: r * sx, ry: r });
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  let top = Infinity;
  for (const b of blobs) {
    x0 = Math.min(x0, b.x - b.rx);
    x1 = Math.max(x1, b.x + b.rx);
    top = Math.min(top, b.y - b.ry);
  }
  return { blobs, x, base, w, h, seed, box: [x0 - 20, top - 20, x1 + 20, base + 12] };
}

// Cloud body and light at a point. The last result is kept: mask, angle and color ask for the same point.
export function cloudField(S, c) {
  const lx = S.light[0] - c.x;
  const ly = S.light[1] - (c.base - c.h * 0.5);
  const ll = Math.hypot(lx, ly) || 1;
  const L = [(lx / ll) * 0.9, (ly / ll) * 0.9, 0.44];
  let mx = NaN;
  let my = NaN;
  let out = null;
  return (x, y) => {
    if (x === mx && y === my) return out;
    let best = -9;
    let second = -9;
    let nx = 0;
    let ny = 0;
    for (const b of c.blobs) {
      const dx = (x - b.x) / b.rx;
      const dy = (y - b.y) / b.ry;
      const q = 1 - Math.sqrt(dx * dx + dy * dy);
      if (q > best) {
        second = best;
        best = q;
        nx = dx;
        ny = dy;
      } else if (q > second) second = q;
    }
    let d = best + (fbm(x / 38, y / 38, c.seed * 17, 3) - 0.5) * 0.36;
    d = Math.min(d, (c.base + 4 - y) / 24);
    const r2 = Math.min(0.98, nx * nx + ny * ny);
    const big = clamp(((x - c.x) / (c.w * 0.5)) * L[0] + ((y - (c.base - c.h * 0.5)) / (c.h * 0.5)) * L[1], -1, 1);
    const lambert = 0.8 * (nx * L[0] + ny * L[1]) * 1.5 + Math.sqrt(1 - r2) * L[2] * 0.5 + 0.4 * big;
    // Creases between puffs are darker.
    const shade = 0.5 + S.cloudTone + 0.5 * lambert - 0.3 * sm(0.5, 0.1, best) * sm(-0.1, 0.2, second) - 0.3 * sm(c.base - c.h * 0.3, c.base, y) + (fbm(x / 70, y / 70, c.seed * 31 + 9, 2) - 0.5) * 0.26;
    mx = x;
    my = y;
    out = { d, shade, nx, ny };
    return out;
  };
}

export function paintCloud(S, c) {
  const { cv, P, R } = S;
  const f = cloudField(S, c);
  const k = clamp(c.w / 420, 0.4, 1.15);
  const body = (x, y) => sm(-0.02, 0.3, f(x, y).d);
  const col = (shift) => (x, y) => {
    const q = f(x, y);
    const tone = 0.6 + S.cloudTone * 0.5 + (q.shade - 0.5 - S.cloudTone) * 0.5;
    const thin = 0.22 + 0.4 * sm(c.base - c.h * 0.45, c.base, y) + 0.3 * sm(0.3, 0, q.d);
    return mix(ramp(P.cloud, tone + shift + R.gauss() * 0.05), S.skyAt(x, y), clamp(thin, 0, 0.8));
  };
  cv.scumble(c.box, "block", { angle: (x, y) => Math.atan2(f(x, y).nx, -f(x, y).ny), jitter: 0.5, len: [18 * k, 44 * k], width: [10 * k, 17 * k], gap: 0.42, lap: 0.6, mask: body, color: col(0), cj: 0.015 });
  // Shadow side: steep hatch. Light side: flatter hatch.
  cv.scumble(c.box, "softPastel", { angle: -0.95, len: [28 * k, 72 * k], width: [3.4, 6], gap: 1.2, lap: 0.75, mask: (x, y) => body(x, y) * sm(0.64, 0.42, f(x, y).shade), color: col(-0.08), cj: 0.03 });
  cv.scumble(c.box, "softPastel", { angle: 0.45, jitter: 0.35, len: [20 * k, 52 * k], width: [3.4, 6.4], gap: 1.25, lap: 0.75, mask: (x, y) => body(x, y) * sm(0.4, 0.6, f(x, y).shade), color: col(0.1), cj: 0.03 });
  cv.scumble(c.box, "pencil", { angle: -0.95, len: [18 * k, 46 * k], width: [1.8, 2.8], gap: 3, lap: 0.8, mask: body, color: (x, y) => col(R() < 0.5 ? -0.1 : 0.1)(x, y), cj: 0.03 });
  // Broken edge: small marks of cloud and of sky along the outline.
  cv.scumble(c.box, "softPastel", { angle: (x, y) => Math.atan2(f(x, y).nx, -f(x, y).ny), jitter: 0.5, len: [8 * k + 4, 22 * k + 6], width: [4, 8], gap: 0.9, lap: 0.8, mask: (x, y) => sm(0.1, 0.02, Math.abs(f(x, y).d)), color: (x, y) => (f(x, y).d > 0 ? col(0)(x, y) : S.skyAt(x, y)), cj: 0.03 });
  // Bright rim on the puffs that face the light.
  cv.scumble(c.box, "oilPastel", { angle: (x, y) => Math.atan2(f(x, y).nx, -f(x, y).ny), jitter: 0.25, len: [8 * k, 18 * k], width: [2.4, 4.4], gap: 1.5, lap: 0.8, mask: (x, y) => sm(0.24, 0.07, f(x, y).d) * sm(0, 0.05, f(x, y).d) * sm(0.55, 0.78, f(x, y).shade - S.cloudTone), color: P.cloud[P.cloud.length - (S.hour === "night" ? 2 : 1)], cj: 0.02 });
  S.cut();
}

export function lowClouds(S, n) {
  const out = [];
  n = Math.round((n * (S.x1 - S.x0)) / 1060);
  for (let i = 0; i < n; i += 2) out.push(makeCloud(S.R, { x: S.x0 + ((i + S.R()) / n) * (S.x1 - S.x0), base: S.yh - S.R.range(14, 70), w: S.R.range(170, 340), h: S.R.range(34, 60), n: 5, sx: 2.6, seed: 40 + i }));
  return out;
}

export function disc(cv, color, x, y, r) {
  cv.hatch(ellipse(x, y, r, r, 0, 36), "oilPastel", color, { angle: cv.R.range(-0.4, 0.4), width: Math.max(3, r * 0.34), spacing: Math.max(1.6, r * 0.16), maxLen: r * 2.4, over: [-1, 1.5], wob: 0.6, cj: 0.015 });
}

// Sky with stars, sun or moon, thin streaks and clouds. Layer 1.
export function paintSky(S, clouds, { cirrus = 26, stars = 0 } = {}) {
  const { cv, P, R, yh, hour, sun } = S;
  cv.layer = 1;
  const box = [S.x0, S.top, S.x1, yh + 12];
  const wide = (S.x1 - S.x0) / 1060;
  const tall = (yh - S.top) / 900;
  cv.scumble(box, "block", { angle: -0.1, len: [120, 220], width: [28, 40], gap: 0.5, lap: 0.55, color: S.skyAt, cj: 0.015 });
  cv.scumble(box, "softPastel", { angle: -0.8, len: [50, 110], width: [4, 7], gap: 1.5, lap: 0.8, press: 0.95, color: (x, y) => S.skyAt(x, y + R.gauss() * (hour === "night" ? 26 : 55)), cj: hour === "night" ? 0.02 : 0.035 });
  cv.scumble(box, "softPastel", { angle: 0.3, len: [40, 90], width: [3, 6], gap: 3.2, lap: 0.8, press: 0.9, color: (x, y) => S.skyAt(x, y - (hour === "night" ? 16 : 40)), cj: hour === "night" ? 0.02 : 0.04 });
  S.cut();

  if (hour === "night") {
    // A pale band of far stars, then the stars.
    const band = (x, y) => Math.exp(-(((y - cv.y0 - 0.42 * (x - cv.x0) - 40) / 110) ** 2));
    cv.scumble([S.x0, S.top, S.x1, yh - 120], "softPastel", { angle: 0.4, len: [30, 70], width: [3, 6], gap: 3, press: 0.75, mask: (x, y) => band(x, y) * 0.7, color: (x, y) => mix(S.skyAt(x, y), P.cloud[4], 0.3), cj: 0.03 });
    for (let i = 0; i < stars * wide * tall; i++) {
      const x = R.range(S.x0, S.x1);
      const y = R.range(S.top, yh - 20);
      if (R() > 0.35 + 0.9 * band(x, y) || R() < sm(yh - 240, yh, y) * 0.85) continue;
      const r = 0.9 + 3.4 * R() ** 7;
      const color = R() < 0.2 ? P.cloud[5] : R() < 0.1 ? P.hot : P.sun;
      cv.dot(x, y, r, color, { press: R.range(0.8, 1.15), grain: 0.3 });
      if (r > 3) {
        cv.pencil(cv.line(x - r * 3.6, y, x + r * 3.6, y, 0.3), color, 1.3, { press: 0.75 });
        cv.pencil(cv.line(x, y - r * 3.6, x, y + r * 3.6, 0.3), color, 1.3, { press: 0.75 });
      }
    }
  }
  if (sun?.moon) {
    // A full disc, then a disc of sky that cuts the crescent.
    disc(cv, P.sun, sun.x, sun.y, sun.r);
    disc(cv, S.skyAt(sun.x + sun.r, sun.y - sun.r * 0.4), sun.x + sun.r * 0.5, sun.y - sun.r * 0.22, sun.r * 0.96);
  }
  S.cut();
  // High thin streaks.
  const count = Math.round((hour === "night" ? cirrus / 3 : cirrus) * wide);
  cv.group(() => {
  for (let i = 0; i < count; i++) {
    const x = R.range(S.x0 + 60, S.x1 - 60);
    const y = R.range(cv.y0 + 30, cv.y0 + (yh - cv.y0) * 0.62);
    const a = R.range(-0.24, -0.04);
    const l = R.range(70, 240);
    const [dx, dy] = [Math.cos(a) * l, Math.sin(a) * l];
    const color = ramp(P.cloud, hour === "night" ? R.range(0.5, 0.66) : R.range(0.72, 1));
    for (let j = 0; j < 5; j++) {
      const o = R.range(-9, 9);
      cv.dryBrush(cv.line(x - dx + R.range(-40, 40), y - dy + o, x + dx + R.range(-40, 40), y + dy + o, 2), color, R.range(2, 7), { press: R.range(0.7, 0.95), dry: 0.75 });
    }
  }
  });
  S.cut();
  for (const c of clouds) paintCloud(S, c);
  if (sun && !sun.moon) {
    cv.scumble([sun.x - sun.r * 3.4, sun.y - sun.r * 2.2, sun.x + sun.r * 3.4, sun.y + sun.r], "oilPastel", { angle: 0, jitter: 0.04, len: [30, 120], width: [2, 5], gap: 7, color: P.sun, cj: 0.02 });
    disc(cv, P.sun, sun.x, sun.y, sun.r);
    // Thin bars of cloud across the sun.
    for (const dy of [-0.42, 0.1, 0.52]) cv.dryBrush(cv.line(sun.x - sun.r * R.range(1.3, 2.6), sun.y + dy * sun.r, sun.x + sun.r * R.range(1.1, 2.4), sun.y + dy * sun.r + R.range(-2, 2), 0.8), P.cloud[4], R.range(3, 5.5), { press: 0.95, dry: 0.5 });
  }
  S.cut();
  cv.layer = 2;
}

// ---------------------------------------------------------------- Sea, land

// One wave mark. Small and close at the horizon, long and wide near the viewer.
function waveMark(S, R, x, y, t, opts) {
  const { cv, P, yh } = S;
  const dm = clamp((y - yh) / S.seaDepth);
  const c = S.seaAt(x, y, t);
  const u = R();
  const color = u < 0.36 ? mix(c, P.sea[0], 0.4) : u < 0.64 ? mix(c, P.glow, 0.34) : c;
  const l = R.range(6 + 70 * dm, 16 + 150 * dm) / 2;
  const a = R.range(-0.07, 0.07);
  cv.softPastel(cv.line(x - Math.cos(a) * l, y - Math.sin(a) * l, x + Math.cos(a) * l, y + Math.sin(a) * l, 2.2), tint(color, R, 0.045), R.range(1.6 + 4.5 * dm, 2.4 + 7 * dm), { press: R.range(0.85, 1.1), ...opts });
}

// Sea from the horizon to y1. Layer 3. The water moves: new wave marks go over old marks all the time.
export function paintSea(S, { y1, glitterTo = y1 - 40, live = true }) {
  const { cv, P, R, yh } = S;
  const d = y1 - yh;
  cv.layer = 3;
  S.seaDepth = d;
  S.seaAt = (x, y, t = 0) => {
    const depth = clamp((y - yh) / d);
    const refl = S.skyAt(x + (vnoise(x / 50, y / 9, 3) - 0.5) * 60, Math.max(S.top, yh - (y - yh) * S.mirror));
    const c = mix(ramp(P.sea, depth ** 0.75), refl, S.refl * (1 - 0.55 * depth));
    const w = fbm((x + t * (4 + 22 * depth)) / (50 + 220 * depth), y / (2.5 + 13 * depth) + t * 0.05, 9, 2);
    return mix(mix(c, P.sea[0], sm(0.56, 0.74, w) * 0.42), P.glow, sm(0.36, 0.2, w) * 0.24);
  };
  cv.scumble([S.x0, yh - 3, S.x1, y1 + 12], "block", { angle: 0, jitter: 0.03, len: [90, 200], width: [14, 26], gap: 0.5, lap: 0.55, color: S.seaAt, cj: 0.015 });
  cv.scumble([S.x0, yh - 1, S.x1, yh + 12], "softPastel", { angle: 0, jitter: 0.008, len: [60, 170], width: [3, 5], gap: 0.6, color: S.dark(P.sea[0], 0.2), cj: 0.03 });
  // Wave marks.
  let marks = 0;
  for (let b = 0; b < 8; b++) {
    const ya = yh + d * (b / 8) ** 1.6;
    const yb = yh + d * ((b + 1) / 8) ** 1.6;
    const dm = ((ya + yb) / 2 - yh) / d;
    const before = cv.queue ? cv.queue.length : 0;
    cv.scumble([S.x0, ya, S.x1, yb], "softPastel", {
      angle: 0, jitter: 0.07, wob: 2.2, len: [6 + 70 * dm, 16 + 150 * dm], width: [1.6 + 4.5 * dm, 2.4 + 7 * dm], gap: 1.35, lap: 0.8, cj: 0.045,
      color: (x, y) => {
        const c = S.seaAt(x, y);
        const u = R();
        return u < 0.36 ? mix(c, P.sea[0], 0.4) : u < 0.64 ? mix(c, P.glow, 0.34) : c;
      },
    });
    if (cv.queue) marks += cv.queue.length - before;
  }
  // Cross hatch on the near water.
  cv.scumble([S.x0, yh + d * 0.25, S.x1, y1 + 12], "pencil", { angle: -0.8, len: [16, 40], width: [1.6, 2.6], gap: 11, press: 0.8, color: (x, y) => (R() < 0.5 ? S.lit(S.seaAt(x, y), 0.18) : S.dark(S.seaAt(x, y), 0.15)), cj: 0.04 });
  const sun = S.sun;
  const path = sun ? { x: sun.x, y0: yh + 3, y1: glitterTo, w0: sun.moon ? 6 : 12, w1: sun.moon ? 80 : 130, n: sun.moon ? 150 : 320 } : null;
  if (path) glitter(S, P.sun, path);
  S.cut();
  cv.layer = 4;
  if (!live) return;
  // All wave marks are painted again in about 40 seconds.
  const L = rng(S.seed + 17);
  const rate = Math.max(40, marks || 4000) / 40;
  let due = 0;
  S.live.push((t, dt) => {
    cv.layer = 3;
    due += rate * dt;
    for (; due >= 1; due--) {
      const y = yh + 14 + (y1 - yh - 14) * L() ** 1.5;
      waveMark(S, L, L.range(cv.x0, cv.x1), y, t, { keep: 3 });
      if (path && L() < 0.07) glitterMark(S, L, P.sun, path, { keep: 3 });
    }
  });
}

function glitterMark(S, R, color, { x, y0, y1, w0 = 8, w1 = 90, k = 1 }, opts) {
  const t = R() ** 1.5;
  const y = y0 + (y1 - y0) * t;
  const w = w0 + (w1 - w0) * t;
  const cx = x + R.gauss() * w * 0.5;
  const len = (5 + 40 * t) * R.range(0.35, 1.25) * k;
  S.cv.oilPastel(S.cv.line(cx - len / 2, y, cx + len / 2, y + R.range(-0.5, 0.5), 0.5), R() < 0.3 ? S.lit(color, 0.5) : color, Math.max(1.2, (1.8 + 3.6 * t) * R.range(0.7, 1.15) * k), { press: R.range(0.75, 1.05), ...opts });
}

// Broken path of light on the water.
export function glitter(S, color, path) {
  for (let i = 0; i < (path.n ?? 120); i++) glitterMark(S, S.R, color, path);
}

// Hill with foliage. h gives the height at x. Light comes from the scene light.
export function paintRidge(S, { h, base, x0, x1, top, seed = 3, haze = 0, dab = [8, 18], tone = 0 }) {
  const { cv, P, R } = S;
  const inside = (x, y) => (y > base - h(x) && y <= base + 3 ? 1 : 0);
  const side = S.light[0] < (x0 + x1) / 2 ? -1 : 1;
  const colorAt = (x, y) => {
    const hx = Math.max(16, h(x));
    const rel = (y - (base - hx)) / hx;
    const slope = (h(x + 30) - h(x - 30)) / 60;
    const l = 0.56 + tone - 0.34 * rel + side * slope * 0.9 + (fbm(x / 55, y / 38, seed, 3) - 0.5) * 0.75 + R.gauss() * 0.07;
    const c = ramp(P.land, l);
    return haze ? mix(c, S.skyAt(x, S.yh - 6), haze) : c;
  };
  const box = [x0, top, x1, base + 4];
  cv.scumble(box, "block", { angle: -0.5, len: [18, 40], width: [9, 15], gap: 0.5, lap: 0.6, mask: inside, color: colorAt, cj: 0.02 });
  cv.scumble(box, "softPastel", { angle: (x, y) => vnoise(x / 34, y / 34, seed + 5) * 3.1, jitter: 0.4, len: dab, width: [4, 8], gap: 0.9, lap: 0.8, mask: inside, color: colorAt, cj: 0.04 });
  cv.scumble(box, "pencil", { angle: 0.9, len: [10, 26], width: [1.8, 2.8], gap: 2.6, mask: inside, color: (x, y) => S.dark(colorAt(x, y), 0.35), cj: 0.03 });
  S.cut();
  return colorAt;
}

export function house(S, x, y, s, far = 0) {
  const { cv, P, R, hour } = S;
  const hgt = s * R.range(0.55, 0.9);
  const tone = (c) => (far ? mix(c, S.skyAt(x, S.yh - 8), far) : c);
  const wall = tone(R.pick(P.wall));
  const split = S.light[0] < x ? 0.12 : -0.12;
  const [first, second] = S.light[0] < x ? [wall, S.dark(wall, 0.32)] : [S.dark(wall, 0.32), wall];
  cv.oilPastel(cv.line(x - s / 2, y - hgt / 2, x + s * split, y - hgt / 2, 0.3), first, hgt, { cap: 0.2 });
  cv.oilPastel(cv.line(x + s * split, y - hgt / 2, x + s / 2, y - hgt / 2, 0.3), second, hgt, { cap: 0.2 });
  const roof = tone(R.pick(P.roof));
  const rw = Math.max(1.8, s * 0.2);
  if (R() < 0.5) {
    cv.oilPastel(cv.line(x - s * 0.58, y - hgt - rw * 0.2, x + s * 0.58, y - hgt - rw * 0.5, 0.3), roof, rw);
  } else {
    cv.oilPastel([[x - s * 0.6, y - hgt + 1], [x - s * 0.04, y - hgt - s * 0.36]], roof, rw * 1.2);
    cv.oilPastel([[x - s * 0.04, y - hgt - s * 0.36], [x + s * 0.6, y - hgt + 1]], S.dark(roof, 0.25), rw * 1.2);
    cv.oilPastel(cv.line(x - s * 0.3, y - hgt - s * 0.1, x + s * 0.3, y - hgt - s * 0.1, 0.2), roof, s * 0.2);
  }
  const n = s > 13 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const wx = x + (n === 1 ? R.range(-0.2, 0.2) : i ? 0.24 : -0.24) * s;
    const on = hour !== "day" && R() < (hour === "night" ? 0.62 : 0.42);
    cv.oilPastel([[wx, y - hgt * 0.72], [wx, y - hgt * 0.38]], on ? P.lamp : tone(S.dark(wall, 0.6)), Math.max(1.4, s * 0.13), { cap: 0.3 });
  }
  S.cut();
}

export function palmMark(S, x, y, s, color) {
  const { cv, R } = S;
  const lean = R.range(-0.25, 0.25) * s;
  cv.pencil(spline([[x, y], [x + lean * 0.4, y - s * 0.55], [x + lean, y - s]], 5), S.dark(color, 0.3), Math.max(1.4, s * 0.06));
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + R.range(-0.15, 0.15);
    const l = s * R.range(0.34, 0.5);
    cv.pencil(spline([[x + lean, y - s], [x + lean + Math.cos(a) * l * 0.6, y - s + Math.sin(a) * l * 0.6 - l * 0.12], [x + lean + Math.cos(a) * l, y - s + Math.sin(a) * l + l * 0.3]], 5), color, Math.max(1.6, s * 0.075), { taper: 0.7 });
  }
  S.cut();
}

// ---------------------------------------------------------------- Objects

// Broken mirror image of a shape in water.
export function reflect(S, color, poly, axis, { squash = 0.7, width = 6, dense = 0, seed = 9 } = {}) {
  const mp = poly.map(([x, y]) => [x, axis + (axis - y) * squash]);
  S.cv.hatch(mp, "dryBrush", color, { angle: 0, width, spacing: width * 0.78, maxLen: 70, over: [-8, 10], jitter: 0.01, cj: 0.03, opts: { dry: 0.7 }, mod: (x, y) => 0.62 + dense + 0.55 * sm(0.3, 0.56, fbm(x / 60, y / 6, seed, 2)) });
  S.cut();
}

// Bird in flight: two curved lines. flap goes from -1 (wings low) to 1 (wings high).
export function gull(cv, color, x, y, s, flap = null, opts) {
  const d = flap === null ? cv.R.range(0.2, 0.5) : 0.06 + 0.5 * (0.5 + 0.5 * flap);
  const w = 1.3 + s * 0.07;
  cv.pencil(spline([[x - s, y + s * d * 0.4], [x - s * 0.5, y - s * d], [x, y]], 6), color, w, opts);
  cv.pencil(spline([[x, y], [x + s * 0.5, y - s * d * 1.1], [x + s, y + s * d * 0.2]], 6), color, w, opts);
}

// Birds that fly: they are on the clear layer and the page draws them again each frame.
// box is the area [x0, y0, x1, y1] where they circle. keep is the highest layer they go across.
export function birds(S, { n, box, size = [4, 15], seed = 1, keep = 1, color = null }) {
  const { P, hour } = S;
  const B = rng(S.seed * 31 + seed);
  if (hour === "night") n = Math.round(n * 0.3);
  const [x0, y0, x1, y1] = box;
  const list = [];
  for (let i = 0; i < n; i++) {
    const near = B() ** 2.6;
    list.push({
      cx: B.range(x0, x1), cy: B.range(y0, y1), rx: B.range(60, 240), ry: B.range(14, 60),
      s: size[0] + (size[1] - size[0]) * near, w: (B() < 0.5 ? -1 : 1) * B.range(0.1, 0.26) * (0.6 + near), ph: B.range(0, 6.28), rate: B.range(4.5, 7.5),
      color: color ?? (hour === "night" ? P.cloud[5] : B() < 0.2 ? S.lit(P.ink, 0.3) : P.ink),
    });
  }
  S.sprites.push({
    seed: 500 + seed,
    draw(ov, t) {
      for (const b of list) {
        const a = b.ph + t * b.w;
        // Glide for a moment, then flap.
        const glide = Math.sin(t * 0.45 + b.ph * 3) > 0.35;
        gull(ov, b.color, b.cx + Math.cos(a) * b.rx, b.cy + Math.sin(a) * b.ry + Math.sin(a * 2.3) * 8, b.s, glide ? -0.2 : Math.sin(t * b.rate + b.ph), { keep });
      }
    },
  });
}

// A loose spiral of birds. Near birds are large.
export function flock(S, { cx, cy, rx, ry, n, size = [4, 17] }) {
  const { cv, P, R, hour } = S;
  if (hour === "night") n = Math.round(n * 0.25);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 9 + R.range(-0.5, 0.5);
    const q = 0.15 + 0.85 * Math.sqrt(R());
    const x = cx + Math.cos(a) * rx * q + R.gauss() * 20;
    const y = cy + Math.sin(a) * ry * q + R.gauss() * 14;
    const s = size[0] + (size[1] - size[0]) * R() ** 2.6;
    gull(cv, hour === "night" ? P.cloud[5] : R() < 0.2 ? S.lit(P.ink, 0.3) : P.ink, x, y, s);
  }
  S.cut();
}

export function pelican(S, x, y, s, dir = 1) {
  const { cv, P } = S;
  const color = P.ink;
  const p = (u, v) => [x + u * s * dir, y + v * s];
  cv.hatch(ellipse(...p(-0.05, -0.4), 0.33 * s, 0.2 * s, -0.5 * dir), "charcoal", color, { angle: -0.5 * dir, width: 0.07 * s, spacing: 0.032 * s, maxLen: 0.5 * s, over: [-1, 1.5], press: 1.35 });
  cv.charcoal([p(-0.3, -0.33), p(-0.44, -0.2), p(-0.53, -0.13)], color, 0.09 * s, { taper: 0.7, press: 1.2 });
  cv.charcoal(spline([p(0.14, -0.5), p(0.26, -0.68), p(0.15, -0.86), p(0.19, -0.99)], 8), color, 0.085 * s, { press: 1.25 });
  cv.dot(...p(0.2, -1.0), 0.075 * s, color, { grain: 0.3 });
  cv.charcoal(cv.line(...p(0.25, -1.0), ...p(0.52, -0.6), 0.4), color, 0.042 * s, { taper: 0.75, press: 1.25 });
  cv.pencil(spline([p(0.26, -0.93), p(0.33, -0.72), p(0.5, -0.61)], 6), color, Math.max(1.8, 0.03 * s), { press: 1.1 });
  cv.hatch([p(0.27, -0.95), p(0.5, -0.61), p(0.35, -0.72)], "pencil", color, { angle: 0.95 * dir, width: Math.max(1.6, 0.022 * s), spacing: 0.02 * s, maxLen: 0.3 * s, over: [-0.5, 0.5] });
  cv.pencil([p(-0.03, -0.22), p(-0.01, 0)], color, Math.max(2, 0.03 * s));
  cv.pencil([p(0.06, -0.22), p(0.08, 0)], color, Math.max(2, 0.03 * s));
  // Light on the back.
  if (s > 50) cv.pencil(spline([p(-0.32, -0.42), p(-0.1, -0.58), p(0.12, -0.56)], 6), S.lit(P.cloud[3], 0.2), 0.03 * s, { press: 0.8 });
  S.cut();
}

export function palm(S, { bx, by, cx, cy, s = 1, back = 0 }) {
  const { cv, P, R, hour } = S;
  const lightLeft = S.light[0] < cx;
  const trunk = spline([[bx, by], [bx + (cx - bx) * 0.2, by + (cy - by) * 0.4], [bx + (cx - bx) * 0.56, by + (cy - by) * 0.78], [cx, cy]], 14);
  for (const k of [-1, 0, 1]) {
    const l = 0.12 + 0.3 * (lightLeft ? 1 - (k + 1) / 2 : (k + 1) / 2) - back * 0.15;
    cv.charcoal(cv.wobble(offsetPath(trunk, k * 4.4 * s), 1), ramp(P.wood, l), 9 * s, { press: 1.2 });
  }
  cv.pencil(cv.wobble(offsetPath(trunk, (lightLeft ? -7 : 7) * s), 0.8), ramp(P.wood, 0.85), 2.2 * s, { press: 0.85 });
  for (let i = 3; i < trunk.length - 2; i += 2) {
    const [a, b] = [offsetPath(trunk, -8.5 * s)[i], offsetPath(trunk, 8.5 * s)[i]];
    cv.pencil(cv.line(a[0], a[1] + 3, b[0], b[1] - 3, 0.6), P.wood[0], 1.8 * s, { press: 0.8 });
  }
  // Fronds: a rib that falls under its weight, with leaflets that hang from it.
  const angles = [2.75, -2.95, 0.1, -2.5, -0.36, -2.05, -0.78, -1.62, -1.2];
  for (const a0 of angles) {
    const a = a0 + R.range(-0.08, 0.08);
    const L = s * R.range(215, 275) * (Math.sin(a) > 0 ? 0.7 : 1);
    const droop = 0.5 + 0.25 * Math.abs(Math.cos(a));
    const toLight = Math.cos(a) * (lightLeft ? -1 : 1);
    const rib = [];
    for (let t = 0; t <= 1.001; t += 0.05) rib.push([cx + Math.cos(a) * L * t, cy + Math.sin(a) * L * t + L * droop * t * t]);
    for (let t = 0.07; t < 0.985; t += 0.026) {
      const i = Math.min(rib.length - 2, Math.floor(t * 20));
      const f = t * 20 - i;
      const px = rib[i][0] + (rib[i + 1][0] - rib[i][0]) * f;
      const py = rib[i][1] + (rib[i + 1][1] - rib[i][1]) * f;
      const ta = Math.atan2(rib[i + 1][1] - rib[i][1], rib[i + 1][0] - rib[i][0]);
      const ll = s * 66 * Math.sin(Math.PI * (0.12 + 0.86 * t)) ** 0.6 * R.range(0.72, 1.08);
      for (const side of [-1, 1]) {
        const an = ta + side * R.range(0.62, 0.92);
        let dx = Math.cos(an);
        let dy = Math.sin(an) + 0.5;
        const dl = Math.hypot(dx, dy);
        dx /= dl;
        dy /= dl;
        // Upper leaflets take the light. Lower leaflets stay dark.
        const l = 0.3 + 0.22 * toLight + (dy < 0.3 ? 0.3 : -0.08) + R.gauss() * 0.16 - back * 0.3;
        const color = hour === "day" ? ramp(P.land, l) : mix(P.ink, ramp(P.land, l + 0.1), 0.55 + 0.3 * toLight * (dy < 0.3 ? 1 : 0.3));
        cv.pencil(cv.line(px, py, px + dx * ll, py + dy * ll, 1.2), color, R.range(2, 3.4) * s, { taper: 0.8, press: R.range(0.9, 1.15) });
      }
    }
    cv.charcoal(rib, S.dark(P.land[0], 0.3), 3.8 * s, { taper: 0.6 });
  }
  for (const [dx, dy] of [[-8, 12], [8, 15], [0, 23]]) cv.dot(cx + dx * s, cy + dy * s, 7.5 * s, P.wood[0], { grain: 0.4 });
  cv.dot(cx + 6 * s, cy + 12 * s, 2.6 * s, ramp(P.wood, 0.7), { grain: 0.4 });
  S.cut();
}

// Small open boat with a canopy. The bow points right, or left with dir -1.
export function yola(S, { x, y, L, body, trim, dir = 1, beached = false, lamp = true }) {
  const { cv, P, R, hour } = S;
  const p = (u, v) => [x + u * L * dir, y + v * L];
  const hullTop = [p(-0.5, -0.1), p(0.3, -0.115), p(0.46, -0.17), p(0.53, -0.2), p(0.49, -0.1), p(-0.5, -0.045)];
  const hullLow = [p(-0.5, -0.05), p(0.49, -0.105), p(0.45, -0.03), p(0.37, 0.045), p(-0.43, 0.055), p(-0.5, 0.0)];
  if (beached) {
    cv.hatch(ellipse(...p(0, 0.06), 0.56 * L, 0.035 * L), "softPastel", S.dark(P.sand[0], 0.45), { angle: 0, width: 5, spacing: 3, maxLen: 80, cj: 0.03 });
  } else {
    reflect(S, S.dark(body, 0.45), [p(-0.5, -0.06), p(0.5, -0.1), p(0.37, 0.045), p(-0.43, 0.055)], y + 0.055 * L, { squash: 1.5, width: Math.max(2.4, 0.026 * L) });
  }
  const w = Math.max(1.6, 0.03 * L);
  cv.hatch(hullTop, "oilPastel", body, { angle: -0.04 * dir, width: w, spacing: w * 0.55, maxLen: 0.6 * L, over: [-1, 2], cj: 0.02 });
  cv.hatch(hullLow, "oilPastel", S.dark(body, 0.4), { angle: -0.04 * dir, width: w, spacing: w * 0.55, maxLen: 0.6 * L, over: [-1, 2], cj: 0.02 });
  cv.oilPastel(cv.line(...p(-0.49, -0.075), ...p(0.47, -0.125), 0.4), S.lit(trim, 0.2), Math.max(1.4, 0.014 * L));
  cv.charcoal([...cv.line(...p(-0.5, -0.1), ...p(0.3, -0.118), 0.6), p(0.46, -0.172), p(0.535, -0.204)], P.ink, Math.max(1.5, 0.017 * L));
  cv.hatch([p(-0.56, -0.2), p(-0.49, -0.2), p(-0.49, -0.07), p(-0.56, -0.07)], "charcoal", P.ink, { angle: 1.5, width: Math.max(1.5, 0.02 * L), spacing: Math.max(1, 0.012 * L), maxLen: 0.2 * L, over: [-1, 1], press: 1.3 });
  cv.pencil(cv.line(...p(-0.52, -0.07), ...p(-0.53, 0.08), 0.3), P.ink, Math.max(1.4, 0.016 * L));
  for (const [u, h] of [[-0.31, -0.37], [-0.24, -0.4], [0.1, -0.41], [0.17, -0.38]]) cv.pencil(cv.line(...p(u, -0.105), ...p(u, h), 0.5), P.ink, Math.max(1.3, 0.011 * L));
  const cw = Math.max(1.6, 0.024 * L);
  cv.hatch([p(-0.37, -0.4), p(0.2, -0.43), p(0.24, -0.385), p(-0.36, -0.35)], "oilPastel", trim, { angle: -0.05 * dir, width: cw, spacing: cw * 0.6, maxLen: 0.5 * L, over: [-1, 2], cj: 0.02 });
  cv.pencil(cv.line(...p(-0.37, -0.35), ...p(0.24, -0.383), 0.5), P.ink, Math.max(1.3, 0.011 * L));
  if (L > 90) {
    // Thwarts, a float and a mooring line.
    for (const u of [-0.2, 0.0, 0.2]) cv.pencil(cv.line(...p(u, -0.11), ...p(u + 0.03, -0.085), 0.2), S.dark(body, 0.55), 0.012 * L);
    cv.dot(...p(0.33, -0.14), 0.018 * L, P.hot, { grain: 0.3 });
    cv.pencil(spline([p(0.5, -0.17), p(0.62, -0.02), p(0.7, 0.07)], 6), P.ink, 0.008 * L + 0.8, { press: 0.8 });
  }
  if (lamp && hour !== "day") {
    const [lx, ly] = p(-0.07, -0.3);
    cv.dot(lx, ly, Math.max(1.6, 0.028 * L), P.lamp, { grain: 0.2 });
    for (let i = 0; i < 6; i++) cv.softPastel(cv.line(lx - R.range(0.04, 0.16) * L, ly + R.range(-0.04, 0.04) * L, lx + R.range(0.04, 0.16) * L, ly + R.range(-0.04, 0.04) * L, 0.5), P.lamp, Math.max(1.4, 0.016 * L), { press: 0.55 });
    if (!beached) glitter(S, P.lamp, { x: lx, y0: y + 0.09 * L, y1: y + 0.55 * L, w0: 0.02 * L, w1: 0.14 * L, n: 18, k: clamp(L / 200, 0.2, 1) });
  }
  S.cut();
}

// Sailing boat at anchor. The sail is furled on the boom.
export function sloop(S, { x, y, L, body }) {
  const { cv, P, hour } = S;
  const p = (u, v) => [x + u * L, y + v * L];
  const hull = [p(-0.5, -0.11), p(0.42, -0.12), p(0.57, -0.2), p(0.4, 0.0), p(-0.4, 0.02), p(-0.52, -0.04)];
  const lw = (k) => Math.max(1.2, k * L);
  reflect(S, S.dark(body, 0.5), hull, y + 0.02 * L, { squash: 1.5, width: lw(0.03) });
  const n = Math.round(8 + L * 0.12);
  for (let i = 0; i < n; i++) {
    const off = Math.sin(i * 1.9) * (0.02 + i * 0.0025) * L;
    const [mx, my] = p(0.05, 0.08 + i * (1.5 / n));
    cv.dryBrush(cv.line(mx + off - 0.045 * L, my, mx + off + 0.045 * L, my, 0.4), S.dark(body, 0.5), lw(0.022), { press: 0.95 - (i / n) * 0.5, dry: 0.7 });
  }
  cv.hatch(hull, "oilPastel", body, { angle: -0.02, width: lw(0.04), spacing: lw(0.022), maxLen: 0.6 * L, over: [-1, 2], cj: 0.02 });
  cv.oilPastel(cv.line(...p(-0.42, 0.0), ...p(0.4, -0.01), 0.4), S.dark(body, 0.5), lw(0.026));
  cv.oilPastel(cv.line(...p(-0.48, -0.085), ...p(0.44, -0.1), 0.4), P.hot, lw(0.02));
  cv.hatch([p(-0.22, -0.2), p(0.12, -0.2), p(0.16, -0.115), p(-0.24, -0.11)], "oilPastel", S.lit(body, 0.35), { angle: 0, width: lw(0.03), spacing: lw(0.018), maxLen: 0.4 * L, over: [-1, 1] });
  if (hour !== "day") cv.dot(...p(-0.05, -0.16), lw(0.018), P.lamp, { grain: 0.2 });
  cv.charcoal(cv.line(...p(0.05, -0.2), ...p(0.045, -1.76), 0.7), hour === "night" ? P.cloud[4] : P.ink, lw(0.02));
  cv.charcoal(cv.line(...p(0.05, -0.33), ...p(-0.44, -0.29), 0.5), P.ink, lw(0.016));
  cv.dryBrush(cv.line(...p(0.02, -0.36), ...p(-0.4, -0.325), 0.6), S.lit(P.sand[2], 0.2), lw(0.05), { dry: 0.2 });
  if (L > 70) for (const u of [-0.3, -0.18, -0.06]) cv.pencil(cv.line(...p(u, -0.39), ...p(u + 0.005, -0.3), 0.2), P.ink, 1.5);
  cv.pencil(cv.line(...p(0.045, -1.74), ...p(0.565, -0.205), 0.8), P.ink, Math.max(1, 0.009 * L), { press: 0.8 });
  cv.pencil(cv.line(...p(0.045, -1.74), ...p(-0.5, -0.115), 0.8), P.ink, Math.max(1, 0.009 * L), { press: 0.8 });
  cv.pencil(cv.line(...p(-0.03, -1.05), ...p(0.13, -1.05), 0.2), P.ink, Math.max(1, 0.01 * L));
  cv.hatch([p(0.05, -1.86), p(0.2, -1.82), p(0.05, -1.78)], "oilPastel", P.hot, { angle: 0.2, width: lw(0.02), spacing: lw(0.012), maxLen: 0.2 * L, over: [-0.5, 1] });
  if (hour !== "day") {
    const [lx, ly] = p(0.045, -1.78);
    cv.dot(lx, ly, Math.max(1.6, 0.026 * L), P.lamp, { grain: 0.2 });
    if (L > 60) {
      cv.pencil(cv.line(lx - 0.09 * L, ly, lx + 0.09 * L, ly, 0.2), P.lamp, 1.3, { press: 0.7 });
      cv.pencil(cv.line(lx, ly - 0.09 * L, lx, ly + 0.09 * L, 0.2), P.lamp, 1.3, { press: 0.7 });
    }
    glitter(S, P.lamp, { x: lx, y0: y + 0.1 * L, y1: y + 0.8 * L, w0: 0.02 * L, w1: 0.12 * L, n: Math.round(6 + L * 0.12), k: clamp(L / 170, 0.2, 1) });
  }
  S.cut();
}

export function buoy(S, x, y, s) {
  const { cv, P } = S;
  cv.dryBrush(cv.line(x - s * 2, y + s * 1.3, x + s * 2, y + s * 1.3, 0.3), S.dark(P.sea[0], 0.3), Math.max(1.6, s * 0.5), { press: 0.8 });
  cv.dot(x, y, s, P.hot, { grain: 0.3 });
  cv.dot(x - s * 0.25, y - s * 0.3, s * 0.35, S.lit(P.hot, 0.5), { grain: 0.3 });
  cv.pencil(cv.line(x, y - s, x + 1, y - s * 2.6, 0.2), P.ink, Math.max(1.3, s * 0.3));
}

// Beach below a shore line.
// Beach below a shore line. shore is a list of points from S.x0 to S.x1.
export function paintBeach(S, shore, { tone = 0 } = {}) {
  const { cv, P, R } = S;
  const shoreY = (x) => {
    let i = 0;
    while (i < shore.length - 2 && shore[i + 1][0] < x) i++;
    const t = clamp((x - shore[i][0]) / (shore[i + 1][0] - shore[i][0] || 1));
    return shore[i][1] + (shore[i + 1][1] - shore[i][1]) * t;
  };
  const y0 = Math.min(...shore.map((q) => q[1]));
  const inside = (x, y) => (y > shoreY(x) ? 1 : 0);
  const sandAt = (x, y) => {
    const up = y - shoreY(x);
    const wet = sm(46, 4, up);
    const c = ramp(P.sand, 0.5 + tone + 0.3 * sm(0, 120, up) - 0.42 * wet + (fbm(x / 110, y / 22, 44, 3) - 0.5) * 0.5 + R.gauss() * 0.05);
    return wet > 0 ? mix(c, S.skyAt(x, S.yh - 90), wet * 0.4) : c;
  };
  const box = [S.x0, y0 - 4, S.x1, S.bottom];
  cv.scumble(box, "block", { angle: -0.07, jitter: 0.05, len: [60, 140], width: [14, 24], gap: 0.5, lap: 0.55, mask: inside, color: sandAt, cj: 0.02 });
  cv.scumble(box, "softPastel", { angle: -0.7, len: [18, 46], width: [3, 5.5], gap: 1.5, mask: inside, color: sandAt, cj: 0.05 });
  cv.scumble(box, "softPastel", { angle: -0.05, jitter: 0.06, len: [20, 70], width: [2, 4], gap: 2.2, mask: inside, color: (x, y) => S.dark(sandAt(x, y), 0.28), cj: 0.04 });
  // Foam: three broken lines that follow the shore.
  for (const [off, w, k] of [[-30, 3, 0.55], [-15, 4.5, 0.8], [-3, 7, 1]]) {
    const pts = shore.map(([x, y]) => [x, y + off + 5 * vnoise(x / 40, off, 6)]);
    cv.oilPastel(cv.wobble(pts, 2), S.lit(P.glow, 0.5), w, { press: k, span: 0.5, mod: (x) => 0.35 + 1.1 * vnoise(x / 34, off * 0.3, 8) });
  }
  cv.scumble([S.x0, y0 - 40, S.x1, y0 + 60], "oilPastel", { angle: 0, jitter: 0.3, len: [4, 12], width: [2, 4], gap: 5, mask: (x, y) => sm(26, 4, Math.abs(y - shoreY(x) + 10)), color: S.lit(P.glow, 0.5) });
  S.cut();
  return { shoreY, sandAt };
}

export function crab(S, x, y, s = 1) {
  const { cv, P } = S;
  cv.dot(x, y, 6.5 * s, P.hot, { grain: 0.3 });
  for (const sx of [-1, 1]) {
    for (const k of [0, 1, 2]) cv.pencil([[x + sx * 5 * s, y + k * 2 * s], [x + sx * (12 + k) * s, y + (k * 5 - 5) * s], [x + sx * (15 + k) * s, y + (2 + k * 5) * s]], P.hot, 1.5 * s);
    cv.pencil([[x + sx * 4 * s, y - 4 * s], [x + sx * 10 * s, y - 12 * s], [x + sx * 8 * s, y - 17 * s]], P.hot, 2 * s);
  }
}


// ---------------------------------------------------------------- Window and motion

// Clouds from a list of [x, base, w, h, puffs, seed] in frame units.
// A tall sky moves them up and makes them larger. A wide window gets more clouds at the sides.
export function skyClouds(S, list) {
  const { cv, yh } = S;
  const q = clamp((yh - cv.y0) / 930, 0.42, 1.9);
  const size = clamp(q, 0.6, 1.3);
  const out = [];
  for (const shift of [-1180, 1180, 0]) {
    for (const [x, base, w, h, n, seed] of list) {
      const cx = x + shift + (shift ? 90 : 0);
      if (cx + w < cv.x0 || cx - w > cv.x1) continue;
      out.push(makeCloud(S.R, { x: cx, base: yh - (yh - base) * q, w: w * size, h: h * size, n, seed: seed + (shift ? 50 + Math.sign(shift) : 0) }));
    }
  }
  return out.sort((a, b) => a.w * a.h - b.w * b.h);
}

// Shore points across the window. pts are the points in the frame. The line continues level at the two sides.
export function shoreLine(S, pts) {
  const all = [...pts];
  if (S.x0 < pts[0][0] - 40) all.unshift([S.x0, pts[0][1] + 6]);
  if (S.x1 > pts[pts.length - 1][0] + 40) all.push([S.x1, pts[pts.length - 1][1] - 6]);
  return spline(all, 10);
}

// The same scene state for the clear layer. Sprites use it to draw kit parts that move.
export function onLayer(S, ov) {
  return { ...S, cv: ov, R: ov.R, cut() {} };
}

// A small boat with a sail that goes across the water. keep 3: it stays behind boats and land.
export function sailer(S, { y, L, speed = 9, dir = 1, body = null, sail = null, seed = 1, keep = 3, x = null }) {
  const { P, cv, hour } = S;
  const span = cv.x1 - cv.x0 + L * 4;
  const start = x ?? cv.x0 + (rng(S.seed + seed)() * span);
  const hull = body ?? P.glow;
  const cloth = sail ?? (hour === "night" ? P.cloud[4] : hour === "dusk" ? S.lit(P.hot, 0.45) : P.sun);
  S.sprites.push({
    seed: 700 + seed,
    keep,
    draw(ov, t) {
      const u = (((start - cv.x0 + L * 2 + dir * speed * t) % span) + span) % span;
      const bx = cv.x0 - L * 2 + u;
      const by = y + Math.sin(t * 1.1 + seed) * L * 0.012;
      const tilt = Math.sin(t * 0.8 + seed * 2) * 0.03;
      const p = (a, b) => [bx + (a + b * tilt) * L * dir, by + b * L];
      const lw = (k) => Math.max(1.2, k * L);
      for (let i = 0; i < 5; i++) {
        const off = Math.sin(i * 1.9 + t * 1.6) * 0.03 * L;
        ov.dryBrush(ov.line(bx + off - 0.2 * L, by + (0.07 + i * 0.07) * L, bx + off + 0.2 * L, by + (0.07 + i * 0.07) * L, 0.4), S.dark(hull, 0.45), lw(0.03), { press: 0.9 - i * 0.12, dry: 0.7 });
      }
      ov.hatch([p(-0.42, -0.1), p(0.5, -0.13), p(0.36, 0.0), p(-0.36, 0.01)], "oilPastel", hull, { angle: 0, width: lw(0.035), spacing: lw(0.02), maxLen: L, over: [-1, 1] });
      ov.charcoal([p(0.04, -0.1), p(0.04, -1.15)], P.ink, lw(0.018));
      ov.hatch([p(0.07, -1.1), p(0.07, -0.2), p(0.5, -0.2)], "oilPastel", cloth, { angle: 1.2 * dir, width: lw(0.04), spacing: lw(0.024), maxLen: L, over: [-1, 1], cj: 0.02 });
      ov.hatch([p(0.0, -1.0), p(0.0, -0.22), p(-0.36, -0.22)], "oilPastel", S.dark(cloth, 0.18), { angle: -1.2 * dir, width: lw(0.04), spacing: lw(0.024), maxLen: L, over: [-1, 1], cj: 0.02 });
      if (hour !== "day") ov.dot(...p(0.04, -1.17), lw(0.03), P.lamp, { grain: 0.2 });
    },
  });
}

// Small lights that change in strength: lamps, stars. pts is a list of [x, y, r].
export function twinkle(S, pts, { color = null, seed = 1, keep = -1 } = {}) {
  const c = color ?? S.P.lamp;
  S.sprites.push({
    seed: 900 + seed,
    keep,
    draw(ov, t) {
      pts.forEach(([x, y, r], i) => {
        const k = 0.5 + 0.5 * Math.sin(t * (1.3 + (i % 7) * 0.31) + i * 2.1);
        if (k > 0.25) ov.dot(x, y, r * (0.7 + 0.6 * k), c, { grain: 0.2, press: 0.75 + 0.35 * k });
      });
    },
  });
}
