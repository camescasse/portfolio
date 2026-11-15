// Montjuïc: the view from the hill across Barcelona to the Collserola range.
// The city grid fills the middle. The port, the sea and the port cable car are at the right.
import { clamp, ellipse, fbm, hex, mix, offsetPath, ramp, rect, rng, sm, spline, vnoise } from "../engine.mjs";
import { birds, lowClouds, paintSea, paintSky, scene, skyClouds, twinkle } from "../kit.mjs";

const yh = 700;
// Depth of the city: from the far edge at the range to the wall of the terrace.
const D = 400;

// Colors of this place. Lists go from dark to light.
const TONES = {
  day: {
    mount: ["#27306e", "#3d4f8c", "#5c7a8c", "#86a384", "#c9c891"],
    wall: ["#fff3df", "#fbe2c2", "#f6cba4", "#eea683", "#da7c62", "#c4dcd6"],
    roof: ["#e2694f", "#c8573f", "#f0b488", "#8f97c4", "#5d6dab"],
    shadow: "#5f5c9c", street: "#474a8c",
    earth: ["#7c3f52", "#c56a58", "#e89a6e", "#f7cc96"],
    stone: ["#8d7f9c", "#d6b9a4", "#f6e2c4", "#fff6e4"],
    agave: ["#1f4a6e", "#3f8a94", "#8cc4b4", "#d9eed4"],
    steel: "#4c5a94", cabin: "#e2452f", lights: ["#ffd76a", "#ffb35a", "#fff2c4"],
  },
  dusk: {
    mount: ["#1b1d58", "#2c3076", "#484692", "#775c9c", "#c07a8c"],
    wall: ["#fbd2a4", "#f6b28c", "#e98f7e", "#c97088", "#96609c", "#6a5a9e"],
    roof: ["#c95f5a", "#8a4a78", "#5a4a90", "#f0a070", "#3f3f88"],
    shadow: "#33307a", street: "#262568",
    earth: ["#33266a", "#754882", "#c46e6e", "#f2a67c"],
    stone: ["#4a4088", "#93689a", "#e09a88", "#fbc8a0"],
    agave: ["#1f2a68", "#3d5894", "#7a8cb8", "#e6aca2"],
    steel: "#1c1c52", cabin: "#d94a3a", lights: ["#ffd866", "#ffb35a", "#ffe9b0"],
  },
  night: {
    mount: ["#090c2e", "#101746", "#19245e", "#243678", "#345090"],
    wall: ["#1c2664", "#243078", "#2e3e8c", "#3a4c9c", "#4a5cae", "#28367a"],
    roof: ["#111746", "#18225c", "#22306e", "#2c3c82", "#141a50"],
    shadow: "#0b0f36", street: "#090c2c",
    earth: ["#0d1136", "#182056", "#27337a", "#44549e"],
    stone: ["#131a4a", "#25306e", "#3f4c94", "#6c7cc0"],
    agave: ["#0d1340", "#1b2b66", "#33508e", "#6a8cc2"],
    steel: "#0a0d2c", cabin: "#b23a3a", lights: ["#ffd866", "#ffb35a", "#fff0c0", "#bfe0ff"],
  },
};

const tones = (hour) => Object.fromEntries(Object.entries(TONES[hour]).map(([k, v]) => [k, Array.isArray(v) ? v.map(hex) : hex(v)]));

// The range: Tibidabo is the highest top. The crest has more tops at the two sides and goes down to the sea.
const TOPS = [[425, 218, 190], [120, 152, 150], [740, 136, 150], [-300, 164, 200], [-700, 120, 250], [960, 62, 120], [1150, 30, 110]];
function range(x) {
  let sum = 0;
  for (const [cx, h, w] of TOPS) sum += (h * Math.exp(-(((x - cx) / w) ** 2))) ** 2.6;
  return sum ** (1 / 2.6) * sm(1330, 1000, x) * (0.92 + 0.16 * vnoise(x / 110, 1.7, 8)) + 9 * vnoise(x / 26, 2, 8);
}
// Lower range in front. It carries the upper streets of the city.
const foothill = (x) => (70 * Math.exp(-(((x - 180) / 260) ** 2)) + 52 * Math.exp(-(((x - 640) / 170) ** 2)) + 60 * Math.exp(-(((x + 330) / 240) ** 2))) * sm(900, 700, x) * (0.85 + 0.3 * vnoise(x / 70, 4.2, 9)) + 4 * vnoise(x / 14, 3, 9);

// A range of hills. Broad marks follow the fall of the slope. lo is the land in front: the hidden part gets no marks.
function paintRange(S, tones, { h, base, top, seed, haze = 0, tone = 0, lo = null }) {
  const { cv, R } = S;
  const inside = (x, y) => (y > base - h(x) && y <= base + 3 && (!lo || y < base - lo(x) + 10) ? 1 : 0);
  // A slope that goes up to the right looks to the left.
  const side = (x) => (S.light[0] < x ? 1 : -1);
  const slope = (x) => (h(x + 30) - h(x - 30)) / 60;
  const colorAt = (x, y) => {
    const hx = Math.max(16, h(x));
    const rel = (y - (base - hx)) / hx;
    // Ravines: dark and light bands that go down the slope.
    const fold = fbm((x + (y - base) * slope(x) * 0.8) / 34, y / 160, seed, 2) - 0.5;
    const l = 0.56 + tone - 0.3 * rel + side(x) * slope(x) * 0.8 + fold * 0.9 + (fbm(x / 70, y / 40, seed + 2, 2) - 0.5) * 0.4 + R.gauss() * 0.06;
    const c = ramp(tones, l);
    return haze ? mix(c, S.skyAt(x, S.yh - 6), haze) : c;
  };
  const fall = (x) => Math.atan2(1, -slope(x) * 1.6);
  const box = [S.x0, top, S.x1, base + 4];
  cv.scumble(box, "block", { angle: (x) => fall(x), jitter: 0.3, len: [26, 56], width: [12, 19], gap: 0.5, lap: 0.6, mask: inside, color: colorAt, cj: 0.02 });
  cv.scumble(box, "softPastel", { angle: (x) => fall(x), jitter: 0.35, len: [12, 30], width: [4.4, 8], gap: 1.15, lap: 0.8, mask: inside, color: colorAt, cj: 0.04 });
  cv.scumble(box, "pencil", { angle: (x) => fall(x) + 0.5, jitter: 0.3, len: [12, 30], width: [1.8, 2.8], gap: 3.4, mask: inside, color: (x, y) => S.dark(colorAt(x, y), 0.35), cj: 0.03 });
  S.cut();
  return colorAt;
}

// The city is at the left of this line. The water is at the right.
const COAST = [[0, 762], [38, 776], [70, 800], [120, 812], [190, 796], [300, 778], [400, 756], [520, 740]];
function coastX(y) {
  const d = y - yh;
  let i = 0;
  while (i < COAST.length - 2 && COAST[i + 1][0] < d) i++;
  const t = clamp((d - COAST[i][0]) / (COAST[i + 1][0] - COAST[i][0] || 1));
  return COAST[i][1] + (COAST[i + 1][1] - COAST[i][1]) * t;
}
// Top edge of the near terrace.
const wallY = (x) => 1088 - 44 * sm(380, -260, x) + 26 * sm(620, 1240, x) + 4 * vnoise(x / 90, 5, 3);
// Size of a building at y.
const sizeAt = (y) => 6.5 + 31 * clamp((y - yh) / D) ** 1.15;
// Avenues: [far x, near x]. Buildings leave a gap.
const AVENUES = [[330, -210], [455, 300], [600, 705], [520, 1230]];
const avenueX = ([far, near], y) => far + (near - far) * clamp((y - yh - 6) / (D - 6)) ** 1.25;

// One building: two faces, a roof line, floor lines and lit windows.
function building(S, C, Q, x, y, s, { tall = 1, lamps = true } = {}) {
  const { cv, R, hour } = S;
  const w = s * R.range(0.78, 1.35);
  const hgt = s * (R() < 0.07 ? R.range(1.5, 2.2) : R.range(0.7, 1.3)) * tall;
  const u = R();
  const v = R();
  const far = 0.44 * (1 - clamp((y - yh) / D)) ** 1.6;
  const tone = (c) => (far > 0.02 ? mix(c, C.haze, far) : c);
  const wall = tone(C.wall[Math.floor(u * C.wall.length)]);
  const shade = mix(wall, C.shadow, 0.46);
  const lightLeft = S.light[0] < x;
  if (s < 10.5) {
    cv.oilPastel(cv.line(x - w / 2, y - hgt / 2, x + w / 2, y - hgt / 2, 0.3), v < 0.4 ? shade : wall, hgt, { cap: 0.2 });
    if (v > 0.5) cv.oilPastel(cv.line(x - w * 0.5, y - hgt, x + w * 0.5, y - hgt, 0.2), tone(C.roof[Math.floor(u * 97) % C.roof.length]), Math.max(1.6, s * 0.16));
  } else {
    const split = (lightLeft ? 0.16 : -0.16) * w;
    cv.oilPastel(cv.line(x - w / 2, y - hgt / 2, x + split, y - hgt / 2, 0.3), lightLeft ? wall : shade, hgt, { cap: 0.2 });
    cv.oilPastel(cv.line(x + split, y - hgt / 2, x + w / 2, y - hgt / 2, 0.3), lightLeft ? shade : wall, hgt, { cap: 0.2 });
    const rw = Math.max(1.8, s * 0.13);
    cv.oilPastel(cv.line(x - w * 0.53, y - hgt - rw * 0.2, x + w * 0.53, y - hgt - rw * 0.4, 0.3), tone(C.roof[Math.floor(v * C.roof.length)]), rw);
    // Floor lines.
    const floors = s < 16 ? 1 : Math.min(3, Math.floor(hgt / (s * 0.42)));
    for (let k = 1; k <= floors; k++) {
      const fy = y - (hgt * k) / (floors + 1);
      cv.pencil(cv.line(x - w * 0.46, fy, x + w * 0.46, fy + R.range(-0.6, 0.6), 0.3), mix(wall, C.shadow, 0.5), Math.max(1.3, s * 0.07), { press: 0.85 });
    }
    if (s > 25) {
      // Windows on near buildings.
      for (let k = 0; k < 3; k++) {
        const wx = x + R.range(-0.4, 0.4) * w;
        const wy = y - R.range(0.15, 0.85) * hgt;
        cv.pencil([[wx, wy - s * 0.07], [wx, wy + s * 0.07]], mix(wall, C.shadow, 0.72), Math.max(1.6, s * 0.075));
      }
    }
  }
  if (hour === "day" || !lamps) return;
  const count = hour === "night" ? (s < 10.5 ? (Q() < 0.62 ? 1 : 0) : 2 + Math.floor(Q() * 4)) : Q() < (s < 10.5 ? 0.16 : 0.5) ? 1 : 0;
  for (let i = 0; i < count; i++) {
    const lx = x + Q.range(-0.42, 0.42) * w;
    const ly = y - Q.range(0.12, 0.9) * hgt;
    // The lamp is painted later, before the next S.cut(). Then the day and the night use the same numbers here.
    C.lamps.push([lx, ly, Math.max(1.1, s * 0.085), C.lights[Math.floor(Q() * C.lights.length)], Q.range(0.85, 1.15)]);
    if (Q() < 0.22) C.sparks.push([lx, ly, Math.max(1.2, s * 0.07)]);
  }
}

// A slim tower with a point: one mark that is thin at its two ends.
function spire(cv, x, y, h, w, color, opts) {
  cv.oilPastel(cv.line(x, y + h * 0.25, x, y - h, 0.25), color, w, { taper: 0.85, ...opts });
}

function sagrada(S, C, x, y, k) {
  const { cv, P, hour } = S;
  const stone = hour === "night" ? mix(C.stone[2], P.lamp, 0.25) : mix(mix(C.wall[3], C.wall[4], 0.5), C.shadow, 0.16);
  const dark = mix(stone, C.shadow, 0.55);
  cv.hatch(rect(x - 30 * k, y - 18 * k, x + 33 * k, y), "oilPastel", dark, { angle: 0, width: 5 * k, spacing: 3 * k, maxLen: 50 * k, over: [-1, 1], cj: 0.02 });
  cv.hatch(rect(x - 30 * k, y - 18 * k, x - 2 * k, y), "oilPastel", stone, { angle: 0, width: 4 * k, spacing: 3 * k, maxLen: 30 * k, over: [-1, 1], cj: 0.02 });
  // Two groups of four towers at the fronts, then the high towers in the middle.
  // Each tower has a light side and a dark side: the towers stay apart.
  const tower = (dx, h, w) => {
    spire(cv, x + dx * k, y - 8 * k, h * k, w * k, S.lit(stone, 0.18));
    spire(cv, x + (dx + w * 0.42) * k, y - 8 * k, h * k * 0.97, w * 0.42 * k, dark, { press: 0.95 });
  };
  for (const [dx, h] of [[-27, 38], [-20, 47], [-13, 47], [-6, 39], [9, 39], [16, 46], [23, 46], [30, 37]]) tower(dx, h, 3.6);
  for (const [dx, h] of [[-9, 57], [11, 57], [-2, 63], [5, 61]]) tower(dx, h, 4.2);
  tower(1.5, 84, 6.4);
  for (const [dx, h] of [[-27, 38], [-13, 47], [16, 46], [30, 37], [-9, 57], [11, 57]]) cv.dot(x + dx * k, y - (8 + h) * k, 1.5 * k, hour === "day" ? P.hot : P.lamp, { grain: 0.2 });
  cv.dot(x + 1.5 * k, y - 90 * k, 2.2 * k, hour === "day" ? P.sun : P.lamp, { grain: 0.2 });
  // A crane at the side.
  cv.pencil(cv.line(x + 31 * k, y, x + 31 * k, y - 74 * k, 0.3), C.steel, 1.5, { press: 0.9 });
  cv.pencil(cv.line(x + 14 * k, y - 71 * k, x + 50 * k, y - 73 * k, 0.3), C.steel, 1.4, { press: 0.9 });
  if (hour !== "day") {
    cv.dot(x + 31 * k, y - 75 * k, 1.6, P.hot, { grain: 0.2 });
    for (let i = 0; i < 9; i++) cv.softPastel(cv.line(x + S.R.range(-22, 20) * k, y - S.R.range(4, 40) * k, x + S.R.range(-22, 20) * k, y - S.R.range(4, 40) * k, 0.4), P.lamp, 2.2, { press: 0.5 });
    C.sparks.push([x + 1.5 * k, y - 90 * k, 2.6 * k]);
  }
  S.cut();
}

// Torre Glòries: a round tower with a round top.
function gloria(S, C, x, y, k) {
  const { cv, P, hour, R } = S;
  const w = 10 * k;
  const h = 62 * k;
  const shape = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (i / 12);
    shape.push([x - Math.cos(a) * w, y - h + w * 1.9 - Math.sin(a) * w * 1.9]);
  }
  const poly = [[x - w, y], ...shape, [x + w, y]];
  const body = hour === "night" ? mix(C.wall[4], P.sea[3], 0.4) : mix(P.sea[1], C.haze, 0.12);
  cv.hatch(poly, "oilPastel", (px, py) => mix(mix(body, P.hot, 0.5 * sm(y - h * 0.5, y, py)), C.shadow, px > x + w * 0.2 ? 0.35 : 0), { angle: 1.55, width: 3.4 * k, spacing: 2.1 * k, maxLen: 40 * k, over: [-1, 1], cj: 0.03 });
  cv.pencil(cv.line(x - w * 0.5, y - h * 0.86, x - w * 0.6, y - 4, 0.3), S.lit(body, 0.45), 1.6, { press: 0.8 });
  if (hour !== "day") {
    for (let i = 0; i < 26; i++) cv.dot(x + R.range(-0.8, 0.8) * w, y - R.range(0.04, 0.9) * h, 1.25, [P.sea[3], P.hot, P.cloud[4], P.lamp][i % 4], { grain: 0.2 });
    C.sparks.push([x, y - h * 0.5, 2]);
  }
  S.cut();
}

// A plain high block.
function slab(S, C, x, y, w, h, color, far = 0.25) {
  const { cv, P, hour, R } = S;
  const c = mix(color, C.haze, far);
  cv.hatch(rect(x - w / 2, y - h, x + w / 2, y), "oilPastel", (px) => (S.light[0] < x === px < x ? c : mix(c, C.shadow, 0.4)), { angle: 1.56, width: Math.max(2.4, w * 0.3), spacing: Math.max(1.6, w * 0.19), maxLen: h, over: [-1, 1], cj: 0.02 });
  cv.pencil(cv.line(x - w / 2, y - h, x + w / 2, y - h, 0.2), mix(c, C.shadow, 0.6), 1.4);
  if (hour !== "day") for (let i = 0; i < h / 5; i++) if (R() < (hour === "night" ? 0.75 : 0.35)) cv.dot(x + R.range(-0.35, 0.35) * w, y - R.range(0.05, 0.95) * h, 1.15, P.lamp, { grain: 0.2 });
  S.cut();
}

// Steel tower of the cable car: four legs with cross braces, a platform and a cabin house.
function mast(S, C, x, base, h, k) {
  const { cv, P, hour } = S;
  const top = base - h;
  const half = (y) => (2.6 + 10.5 * ((y - top) / h) ** 1.25) * k;
  const steel = C.steel;
  const lw = Math.max(1.4, 2.1 * k);
  for (const side of [-1, 1]) {
    const leg = [];
    for (let i = 0; i <= 8; i++) {
      const y = top + (h * i) / 8;
      leg.push([x + side * half(y), y]);
    }
    cv.charcoal(leg, steel, lw * 1.3, { press: 1.25 });
  }
  const levels = 9;
  for (let i = 0; i < levels; i++) {
    const ya = top + (h * i) / levels;
    const yb = top + (h * (i + 1)) / levels;
    cv.pencil(cv.line(x - half(ya), ya, x + half(yb), yb, 0.3), steel, lw * 0.7, { press: 0.95 });
    cv.pencil(cv.line(x + half(ya), ya, x - half(yb), yb, 0.3), steel, lw * 0.7, { press: 0.95 });
    cv.pencil(cv.line(x - half(yb), yb, x + half(yb), yb, 0.2), steel, lw * 0.8);
  }
  cv.pencil(cv.line(x - half(top + h * 0.3) * 0.4, top, x - half(base) * 0.5, base, 0.3), S.lit(steel, hour === "day" ? 0.5 : 0.25), lw * 0.6, { press: 0.75 });
  // Platform at mid height. The station is at the top.
  const py = top + h * 0.45;
  cv.oilPastel(cv.line(x - half(py) - 5 * k, py, x + half(py) + 5 * k, py, 0.2), steel, 4.5 * k);
  cv.hatch(rect(x - 12 * k, top - 13 * k, x + 12 * k, top + 2 * k), "oilPastel", hour === "night" ? mix(steel, C.stone[2], 0.3) : mix(steel, C.stone[3], 0.55), { angle: 0, width: 3.4 * k, spacing: 2.2 * k, maxLen: 30 * k, over: [-1, 1] });
  cv.oilPastel(cv.line(x - 14 * k, top - 14 * k, x + 14 * k, top - 14 * k, 0.2), steel, 3 * k);
  cv.pencil(cv.line(x, top - 15 * k, x, top - 30 * k, 0.2), steel, lw * 0.7);
  cv.dot(x, top - 31 * k, 1.9 * k, P.hot, { grain: 0.2 });
  if (hour !== "day") {
    for (const dx of [-7, 0, 7]) cv.dot(x + dx * k, top - 6 * k, 1.5 * k, P.lamp, { grain: 0.2 });
    cv.dot(x, py - 4 * k, 1.6 * k, P.lamp, { grain: 0.2 });
  }
}

// Cable between two points with a small sag.
function cable(a, b, sag = 0.045, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.hypot(b[0] - a[0], b[1] - a[1]) * sag * Math.sin(Math.PI * t)]);
  }
  return pts;
}
const along = (pts, t) => {
  const u = clamp(t) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(u));
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * (u - i), pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (u - i)];
};

// Stone pine: a bare trunk that forks, and a flat crown of round masses.
function stonePine(S, { bx, by, cx, cy, rx, ry, s = 1, seed = 1 }) {
  const { cv, P, R, hour } = S;
  const lightLeft = S.light[0] < cx;
  const fork = [cx + (bx - cx) * 0.12, cy + ry * 1.25];
  const trunk = spline([[bx, by], [bx + (fork[0] - bx) * 0.3, by + (fork[1] - by) * 0.42], [bx + (fork[0] - bx) * 0.75, by + (fork[1] - by) * 0.8], fork], 12);
  const bark = (l) => (hour === "day" ? ramp(P.wood, l) : mix(P.ink, ramp(P.wood, l + 0.1), 0.6));
  for (const k of [-1, 0, 1]) {
    const l = 0.1 + 0.34 * (lightLeft ? 1 - (k + 1) / 2 : (k + 1) / 2);
    cv.charcoal(cv.wobble(offsetPath(trunk, k * 5.4 * s), 1.2), bark(l), 11 * s, { press: 1.25 });
  }
  cv.pencil(cv.wobble(offsetPath(trunk, (lightLeft ? -9 : 9) * s), 1), bark(0.85), 2.6 * s, { press: 0.85 });
  for (let i = 2; i < trunk.length - 1; i += 2) {
    const [a, b] = [offsetPath(trunk, -9 * s)[i], offsetPath(trunk, 9 * s)[i]];
    cv.pencil(cv.line(a[0], a[1] + 5, b[0] + R.range(-3, 3), b[1] - 5, 0.8), P.wood[0], 2 * s, { press: 0.8 });
  }
  // Branches to the under side of the crown.
  for (const [dx, dy, w] of [[-0.62, 0.3, 6], [-0.3, 0.05, 7], [0.08, -0.1, 7.5], [0.42, 0.1, 6.5], [0.72, 0.35, 5]]) {
    const end = [cx + dx * rx, cy + dy * ry];
    cv.charcoal(spline([fork, [fork[0] + (end[0] - fork[0]) * 0.5, fork[1] + (end[1] - fork[1]) * 0.42], end], 8), bark(0.16), w * s, { taper: 0.5, press: 1.2 });
  }
  // Crown: round masses on a level base.
  const lobes = [];
  const L = rng(900 + seed);
  for (let i = 0; i < 11; i++) {
    const u = (i + 0.5) / 11 - 0.5;
    lobes.push([cx + u * 1.8 * rx + L.gauss() * rx * 0.05, cy - ry * (0.2 + 0.5 * Math.cos(u * Math.PI) * L.range(0.6, 1.1)), rx * L.range(0.2, 0.31), ry * L.range(0.5, 0.78)]);
  }
  const field = (x, y) => {
    let best = -9;
    for (const [lx, ly, lrx, lry] of lobes) {
      const q = 1 - Math.hypot((x - lx) / lrx, (y - ly) / lry);
      if (q > best) best = q;
    }
    return Math.min(best + (fbm(x / 26, y / 26, seed * 7, 2) - 0.5) * 0.5, (cy + ry * 0.42 - y) / 16);
  };
  const body = (x, y) => sm(-0.04, 0.16, field(x, y));
  const tone = (x, y) => 0.36 + 0.5 * clamp((cy + ry * 0.2 - y) / (ry * 1.3)) + (lightLeft ? -1 : 1) * 0.16 * ((x - cx) / rx) + (fbm(x / 34, y / 22, seed * 3, 2) - 0.5) * 0.6;
  const leaf = (shift) => (x, y) => {
    const l = tone(x, y) + shift + R.gauss() * 0.05;
    return hour === "day" ? ramp(P.land, l) : mix(P.ink, ramp(P.land, l), hour === "dusk" ? 0.5 : 0.62);
  };
  const box = [cx - rx * 1.15, cy - ry * 1.25, cx + rx * 1.15, cy + ry * 0.6];
  cv.scumble(box, "block", { angle: -0.2, jitter: 0.4, len: [22, 44], width: [11, 17], gap: 0.5, lap: 0.6, mask: body, color: leaf(-0.14), cj: 0.02 });
  cv.scumble(box, "softPastel", { angle: (x, y) => -1.2 + vnoise(x / 20, y / 20, seed) * 2.2, jitter: 0.5, len: [9, 22], width: [4, 7], gap: 1.6, lap: 0.8, mask: body, color: leaf(0), cj: 0.04 });
  cv.scumble(box, "softPastel", { angle: 0.25, jitter: 0.4, len: [8, 22], width: [3, 5.4], gap: 1.9, lap: 0.8, mask: (x, y) => body(x, y) * sm(0.5, 0.75, tone(x, y)), color: leaf(0.24), cj: 0.04 });
  cv.scumble(box, "pencil", { angle: -1.0, len: [8, 18], width: [1.8, 2.8], gap: 3.6, mask: (x, y) => body(x, y) * sm(0.62, 0.4, tone(x, y)), color: S.dark(P.land[0], 0.3), cj: 0.03 });
  S.cut();
}

// Cypress: a dark narrow tree.
function cypress(S, x, base, h, w, seed = 1) {
  const { cv, P, R, hour } = S;
  const lightLeft = S.light[0] < x;
  const half = (y) => {
    const t = clamp((base - y) / h);
    return w * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.08)) ** 0.55 * (1 - t) ** 0.42 * 1.5;
  };
  const inside = (px, py) => (py < base && py > base - h && Math.abs(px - x + (vnoise(py / 14, seed, 4) - 0.5) * w * 0.3) < half(py) ? 1 : 0);
  const tone = (px, py) => 0.2 + (lightLeft ? -1 : 1) * 0.3 * ((px - x) / (w * 0.5)) + (fbm(px / 12, py / 26, seed * 5, 2) - 0.5) * 0.5 + R.gauss() * 0.05;
  const leaf = (px, py) => (hour === "day" ? ramp(P.land, tone(px, py)) : mix(P.ink, ramp(P.land, tone(px, py) + 0.1), 0.5));
  const box = [x - w, base - h - 6, x + w, base + 2];
  cv.charcoal(cv.line(x, base + 8, x, base - h * 0.2, 0.6), P.wood[0], Math.max(3, w * 0.12));
  cv.scumble(box, "block", { angle: -1.45, jitter: 0.15, len: [22, 44], width: [9, 13], gap: 0.5, lap: 0.6, mask: inside, color: leaf, cj: 0.02 });
  cv.scumble(box, "softPastel", { angle: -1.3, jitter: 0.3, len: [12, 28], width: [3.6, 6.4], gap: 2, lap: 0.8, mask: inside, color: leaf, cj: 0.04 });
  cv.scumble(box, "pencil", { angle: -1.5, jitter: 0.2, len: [10, 24], width: [1.8, 2.6], gap: 4.5, mask: inside, color: S.dark(P.land[0], 0.35), cj: 0.03 });
  S.cut();
}

// Agave: a rosette of thick leaves with points.
function agave(S, C, x, y, s, seed = 1) {
  const { cv, R } = S;
  const A = rng(1200 + seed);
  const leaves = [];
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI * (0.06 + (0.88 * i) / 12) + A.range(-0.08, 0.08);
    leaves.push([a, s * A.range(0.75, 1.1) * (0.72 + 0.4 * Math.sin(-a))]);
  }
  // Back leaves first: the leaves that go up are behind the leaves that go to the sides.
  leaves.sort((p, q) => Math.abs(Math.cos(p[0])) - Math.abs(Math.cos(q[0])));
  for (const [a, len] of leaves) {
    const bend = Math.cos(a) * 0.34;
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len + Math.abs(Math.cos(a)) * len * 0.3];
    const mid = [x + Math.cos(a - bend * 0.5) * len * 0.55, y + Math.sin(a - bend * 0.5) * len * 0.62];
    const pts = spline([[x - Math.cos(a) * s * 0.06, y + s * 0.08], mid, tip], 8);
    const l = 0.3 + 0.45 * (S.light[0] < x ? -Math.cos(a) : Math.cos(a)) * 0.5 + 0.3 * Math.sin(-a) + R.gauss() * 0.05;
    cv.oilPastel(pts, ramp(C.agave, l), s * 0.19, { taper: 0.82, press: 1.1 });
    cv.pencil(offsetPath(pts, -s * 0.045), ramp(C.agave, l + 0.4), Math.max(1.6, s * 0.022), { press: 0.8, taper: 0.6 });
    cv.pencil(offsetPath(pts, s * 0.05), ramp(C.agave, l - 0.4), Math.max(1.6, s * 0.022), { press: 0.8, taper: 0.6 });
    cv.dot(tip[0], tip[1], Math.max(1.5, s * 0.022), C.agave[0], { grain: 0.3 });
  }
  S.cut();
}

function draw(cv, hour) {
  const light = { day: [1320, -280], dusk: [50, yh - 142], night: [860, 200] }[hour];
  const S = scene(cv, hour, { seed: 707, yh, light, refl: { day: 0.3, dusk: 0.6, night: 0.45 }[hour], glowR: hour === "day" ? 520 : 300 });
  const { P, R } = S;
  const C = tones(hour);
  C.sparks = [];
  C.lamps = [];
  const lamps = () => {
    for (const [x, y, r, color, press] of C.lamps) cv.dot(x, y, r, color, { grain: 0.2, press });
    C.lamps.length = 0;
  };
  // Lit windows use their own numbers. The layout stays the same at all hours.
  const Q = rng(7070);
  if (hour === "night") {
    S.sun = { x: 860, y: S.sy(0.26), r: 26, moon: true };
    S.light = [S.sun.x, S.sun.y];
  } else if (hour === "dusk") S.sun = { x: 50, y: yh - 142, r: 36 };
  C.haze = S.skyAt(500, yh - 14);
  S.washAt = (x, y) => (y < yh ? S.skyAt(x, y) : x < coastX(y) ? mix(mix(C.wall[2], C.shadow, 0.45), C.haze, 0.3 * (1 - clamp((y - yh) / D))) : mix(S.skyAt(x, yh - 30), P.sea[1], 0.55));

  const clouds = [...lowClouds(S, 5), ...skyClouds(S, [[840, 330, 270, 140, 8, 21], [230, 250, 220, 105, 6, 22], [600, 470, 400, 240, 11, 23]])];
  paintSky(S, clouds, { cirrus: 30, stars: 1200 });
  birds(S, { n: 30, box: [S.sx(0.08), S.sy(0.25), S.sx(0.92), yh + 60], size: [3, 9], seed: 2, keep: 5 });

  // ---------------------------------------------------------------- The range
  const base = yh + 4;
  const far = (x) => (range(x + 170) * 0.8 + 46) * sm(1180, 800, x);
  paintRange(S, C.mount, { h: far, base, top: yh - 240, seed: 30, haze: 0.56, tone: 0.12, lo: range });
  const rangeAt = paintRange(S, C.mount, { h: range, base, top: yh - 260, seed: 31, haze: 0.18, lo: foothill });
  // Light on the high slopes.
  cv.scumble([S.x0, yh - 250, S.x1, yh], "softPastel", { angle: -0.5, jitter: 0.3, len: [10, 26], width: [2.6, 4.6], gap: 4, mask: (x, y) => (y > base - range(x) + 3 && y < base - range(x) * 0.6 ? 1 : 0), color: (x, y) => S.lit(rangeAt(x, y), 0.3), press: 0.85, cj: 0.03 });
  S.cut();
  // Torre de Collserola: a thin mast with a pod.
  const [tx, ty] = [318, base - range(318)];
  cv.pencil(cv.line(tx, ty + 2, tx, ty - 78, 0.3), C.steel, 2, { press: 1 });
  cv.oilPastel(cv.line(tx, ty - 36, tx, ty - 52, 0.2), mix(C.steel, C.haze, 0.2), 5.5);
  cv.pencil(cv.line(tx, ty - 78, tx, ty - 96, 0.2), C.steel, 1.3, { press: 0.9 });
  for (const side of [-1, 1]) cv.pencil(cv.line(tx, ty - 50, tx + side * 16, ty + 3, 0.3), C.steel, 1.1, { press: 0.6 });
  cv.dot(tx, ty - 97, 1.7, P.hot, { grain: 0.2 });
  // Tibidabo: the church on the top, and the wheel of the old park.
  const [cx0, cy0] = [428, base - range(428)];
  const church = mix(C.stone[2], C.haze, 0.3);
  cv.hatch(rect(cx0 - 13, cy0 - 12, cx0 + 13, cy0 + 2), "oilPastel", mix(church, C.shadow, 0.3), { angle: 0, width: 3.4, spacing: 2.2, maxLen: 30, over: [-1, 1] });
  for (const [dx, h] of [[-11, 15], [11, 15], [-5, 20], [5, 20]]) spire(cv, cx0 + dx, cy0 - 8, h, 3.6, church);
  spire(cv, cx0, cy0 - 10, 34, 5.6, S.lit(church, 0.3));
  cv.dot(cx0, cy0 - 45, 1.7, hour === "day" ? P.sun : P.lamp, { grain: 0.2 });
  const wheel = ellipse(cx0 - 38, cy0 - 11, 9, 9, 0, 16);
  cv.pencil([...wheel, wheel[0]], C.steel, 1.2, { press: 0.8 });
  // Antennas on the second top.
  for (const [ax, ah] of [[-418, 40], [-396, 26]]) {
    cv.pencil(cv.line(ax, base - range(ax), ax, base - range(ax) - ah, 0.3), C.steel, 1.5);
    cv.dot(ax, base - range(ax) - ah - 1, 1.5, P.hot, { grain: 0.2 });
  }
  if (hour !== "day") {
    C.sparks.push([tx, ty - 97, 2.2], [cx0, cy0 - 45, 2.4]);
    for (let i = 0; i < 16; i++) cv.softPastel(cv.line(cx0 + R.range(-16, 8), cy0 - R.range(0, 26), cx0 + R.range(-8, 16), cy0 - R.range(0, 26), 0.4), P.lamp, 2, { press: 0.5 });
  }
  S.cut();
  // The lower range, with the high streets of the city on it.
  paintRange(S, C.mount.map((c, i) => mix(c, C.wall[2], hour === "day" ? 0.1 + 0.05 * i : 0.04)), { h: foothill, base, top: yh - 100, seed: 33, haze: 0.1, tone: -0.06 });
  for (let i = 0; i < ((S.x1 - S.x0) / 1060) * 150; i++) {
    const x = R.range(S.x0, Math.min(S.x1, 880));
    const rel = R() ** 1.5;
    const top = foothill(x) + (range(x) - foothill(x)) * 0.16;
    if (top < 12) continue;
    building(S, C, Q, x, base - top * rel, R.range(4.6, 7.6));
  }
  lamps();
  S.cut();

  // ---------------------------------------------------------------- Sea and port water
  const seaX = 700;
  const W = { ...S, x0: Math.max(S.x0, seaX), sun: hour === "dusk" ? null : S.sun };
  if (S.x1 > seaX) paintSea(W, { y1: 1150, glitterTo: yh + 360 });
  Object.assign(S, { seaAt: W.seaAt, seaDepth: W.seaDepth });
  cv.layer = 4;
  S.cut();
  // Far breakwater with a light at its end. The sail hotel is on it.
  const bw = [[800, yh + 66], [900, yh + 54], [1010, yh + 50], [1130, yh + 46], [S.x1 + 20, yh + 44]].filter(([x], i, all) => i < 2 || x > all[i - 1][0]);
  cv.dryBrush(cv.wobble(spline(bw, 8), 0.8), mix(C.stone[1], C.haze, 0.25), 4.5, { dry: 0.15, press: 1.05 });
  cv.pencil(cv.wobble(spline(bw, 8).map(([x, y]) => [x, y - 2.4]), 0.6), mix(C.stone[3], C.haze, 0.3), 1.6, { press: 0.8 });
  const [hx, hy] = [1136, yh + 45];
  const sail = [[hx - 15, hy], [hx - 15, hy - 40], [hx - 9, hy - 58], [hx + 2, hy - 68], [hx + 13, hy - 46], [hx + 17, hy]];
  cv.hatch(sail, "oilPastel", (x) => (x < hx - 2 ? mix(P.cloud[5], C.haze, 0.3) : mix(P.sea[1], C.haze, 0.35)), { angle: 1.5, width: 3.4, spacing: 2.1, maxLen: 60, over: [-1, 1], cj: 0.02 });
  if (hour !== "day") for (let i = 0; i < 16; i++) cv.dot(hx + R.range(-11, 12), hy - R.range(3, 52), 1.15, P.lamp, { grain: 0.2 });
  S.cut();
  // Second tower of the cable car, far at the right.
  const t2 = [1215, yh + 150, 108, 0.62];
  cv.dryBrush(cv.line(1150, yh + 152, S.x1 + 20, yh + 146, 0.8), mix(C.stone[1], C.haze, 0.15), 9, { dry: 0.15 });
  for (let x = 1160; x < S.x1; x += R.range(15, 26)) building(S, C, Q, x, yh + 150, R.range(8, 12));
  lamps();
  S.cut();

  // ---------------------------------------------------------------- The city
  const inCity = (x, y) => (y > yh + 1 && x < coastX(y) ? 1 : 0);
  const mottle = (x, y) => fbm(x / 26, y / 9, 71, 2);
  const groundAt = (x, y) => {
    const t = clamp((y - yh) / D);
    const m = mottle(x, y);
    const c = mix(C.shadow, C.wall[Math.floor(clamp(m * 1.5 - 0.25) * (C.wall.length - 1))], 0.32 + 0.3 * sm(0.4, 0.6, m));
    return mix(c, C.haze, 0.42 * (1 - t) ** 1.6);
  };
  const cityBox = [S.x0, yh, Math.min(S.x1, 830), 1140];
  cv.scumble(cityBox, "block", { angle: 0, jitter: 0.05, len: [50, 110], width: [12, 20], gap: 0.5, lap: 0.55, mask: inCity, color: groundAt, cj: 0.02 });
  // Far streets: small level marks in the colors of the walls and roofs.
  cv.scumble([cityBox[0], yh + 2, cityBox[2], yh + 150], "softPastel", {
    angle: 0, jitter: 0.06, len: [5, 13], width: [2.6, 4.6], gap: 2.1, lap: 0.8, mask: (x, y) => inCity(x, y) * sm(yh + 150, yh + 60, y), cj: 0.04,
    color: (x, y) => mix(R() < 0.3 ? C.roof[Math.floor(R() * C.roof.length)] : C.wall[Math.floor(R() * C.wall.length)], C.haze, 0.42 * (1 - clamp((y - yh) / D)) ** 1.6),
  });
  S.cut();
  // Avenues: a dark line, then trees by day or lamps at night.
  cv.group(() => {
    for (const av of AVENUES) {
      const pts = [];
      for (let y = yh + 10; y < 1150; y += 22) if (avenueX(av, y) < coastX(y) - 6) pts.push([avenueX(av, y), y]);
      if (pts.length < 3) continue;
      cv.softPastel(cv.wobble(pts, 1), mix(C.street, C.haze, 0.15), 6.5, { press: 1.05, mod: (x, y) => 0.45 + 0.8 * clamp((y - yh) / D) });
    }
  });
  // The diagonal avenue across the grid.
  const diag = (x) => yh + 150 - (x - 60) * 0.1;
  cv.softPastel(cv.line(S.x0, diag(S.x0), 770, diag(770), 1.5), mix(C.street, C.haze, 0.2), 4.6, { press: 0.95 });
  S.cut();

  const marks = [
    { y: yh + 78, draw: () => sagrada(S, C, 590, yh + 78, 1.62) },
    { y: yh + 58, draw: () => gloria(S, C, 712, yh + 58, 1.4) },
    { y: yh + 40, draw: () => slab(S, C, 748, yh + 40, 11, 68, mix(P.sea[1], C.shadow, 0.3), 0.22) },
    { y: yh + 41, draw: () => slab(S, C, 764, yh + 41, 11, 66, C.stone[2], 0.2) },
    { y: yh + 96, draw: () => slab(S, C, 236, yh + 96, 13, 54, C.wall[1], 0.22) },
    { y: yh + 120, draw: () => slab(S, C, 96, yh + 120, 15, 62, C.wall[3], 0.2) },
    { y: yh + 84, draw: () => slab(S, C, -160, yh + 84, 12, 50, C.wall[2], 0.25) },
    { y: yh + 132, draw: () => slab(S, C, 1010 - 620, yh + 132, 14, 58, mix(P.sea[1], C.wall[5], 0.5), 0.2) },
    {
      // The old cathedral: one high point and two low points.
      y: yh + 168,
      draw: () => {
        const stone = mix(C.stone[1], C.shadow, 0.25);
        cv.hatch(rect(646, yh + 150, 690, yh + 168), "oilPastel", stone, { angle: 0, width: 4, spacing: 2.6, maxLen: 50, over: [-1, 1] });
        spire(cv, 668, yh + 150, 44, 7, S.lit(stone, 0.15));
        for (const dx of [-17, 17]) spire(cv, 668 + dx, yh + 152, 28, 6, stone);
        if (hour !== "day") for (let i = 0; i < 7; i++) cv.softPastel(cv.line(650 + R.range(0, 30), yh + 166 - R.range(0, 40), 660 + R.range(0, 30), yh + 166 - R.range(0, 40), 0.4), P.lamp, 2.2, { press: 0.5 });
        S.cut();
      },
    },
    {
      // The three chimneys of the old power station.
      y: yh + 268,
      draw: () => {
        for (const [dx, h] of [[0, 96], [17, 100], [34, 94]]) {
          const x = 258 + dx;
          const lit = S.light[0] < x;
          cv.oilPastel(cv.line(x - 2.4, yh + 268, x - 1.4, yh + 268 - h, 0.4), lit ? C.wall[2] : mix(C.wall[4], C.shadow, 0.3), 5);
          cv.oilPastel(cv.line(x + 2.4, yh + 268, x + 1.6, yh + 268 - h, 0.4), lit ? mix(C.wall[4], C.shadow, 0.3) : C.wall[2], 5);
          cv.oilPastel(cv.line(x - 5, yh + 268 - h, x + 5, yh + 268 - h, 0.2), C.roof[0], 3);
          if (hour !== "day") cv.dot(x, yh + 264 - h, 1.7, P.hot, { grain: 0.2 });
        }
        S.cut();
      },
    },
    {
      // The column at the end of the long street, near the water.
      y: yh + 238,
      draw: () => {
        cv.charcoal(cv.line(735, yh + 238, 735, yh + 184, 0.3), mix(C.steel, C.stone[1], 0.4), 3.4);
        cv.dot(735, yh + 180, 2.6, hour === "day" ? C.steel : P.lamp, { grain: 0.3 });
      },
    },
  ].sort((a, b) => a.y - b.y);

  // Rows of buildings: far rows first. They are one layer above the ground.
  cv.layer = 5;
  let mi = 0;
  for (let y = yh + 11; y < 1150; y += sizeAt(y) * 0.64) {
    while (mi < marks.length && marks[mi].y <= y) marks[mi++].draw();
    const s = sizeAt(y);
    const end = Math.min(S.x1, coastX(y) - s * 0.5);
    for (let x = S.x0 - R() * s; x < end; x += s * R.range(1.2, 1.7)) {
      const by = y + R.range(-0.2, 0.2) * s;
      if (by - s * 1.5 > wallY(x) + 34) continue;
      if (AVENUES.some((av) => Math.abs(x - avenueX(av, by)) < 2.5 + s * 0.3)) continue;
      if (Math.abs(by - diag(x)) < 3 + s * 0.12 && x < 770) continue;
      building(S, C, Q, x, by, s * R.range(0.84, 1.14));
    }
    lamps();
    S.cut();
  }
  while (mi < marks.length) marks[mi++].draw();
  // Lamps along the avenues, and a field of small far lights.
  if (hour !== "day") {
    for (const av of AVENUES) {
      for (let y = yh + 14; y < 1140; y += (2.4 + sizeAt(y) * 0.22) * (hour === "night" ? 1 : 2.2)) {
        const x = avenueX(av, y);
        if (x > coastX(y) - 6 || y > wallY(x) + 20) continue;
        cv.dot(x + Q.range(-1.5, 1.5), y, 0.9 + sizeAt(y) * 0.045, C.lights[Q() < 0.75 ? 0 : 1], { grain: 0.2 });
      }
    }
    for (let x = S.x0; x < 770; x += Q.range(5, 9) * (hour === "night" ? 1 : 2)) cv.dot(x, diag(x) + Q.range(-1.5, 1.5), 1.3, C.lights[0], { grain: 0.2 });
    cv.scumble([S.x0, yh - 6, Math.min(S.x1, 830), yh + 120], "softPastel", { angle: 0, jitter: 0.05, len: [20, 60], width: [2.4, 4.4], gap: hour === "night" ? 2.6 : 5, mask: (x, y) => inCity(x, y + 8) * sm(yh + 120, yh + 20, y), color: mix(C.lights[1], C.haze, 0.35), press: 0.55, cj: 0.03 });
    const n = ((S.x1 - S.x0) / 1060) * (hour === "night" ? 2300 : 520);
    for (let i = 0; i < n; i++) {
      const y = yh + 4 + 340 * Q() ** 1.5;
      const x = Q.range(S.x0, Math.min(S.x1, coastX(y) - 3));
      if (y > wallY(x) + 22) continue;
      cv.dot(x, y, Q.range(0.8, 1.35) * (1 + 1.1 * ((y - yh) / 340)), C.lights[Math.floor(Q() * C.lights.length)], { grain: 0.2, press: Q.range(0.8, 1.1) });
    }
  } else {
    for (const av of AVENUES) {
      for (let y = yh + 60; y < 1140; y += 5 + sizeAt(y) * 0.5) {
        const x = avenueX(av, y) + R.range(-1, 1) * (2 + sizeAt(y) * 0.2);
        if (x > coastX(y) - 6) continue;
        cv.dot(x, y, 1.2 + sizeAt(y) * 0.11, ramp(P.land, R.range(0.25, 0.75)), { grain: 0.4 });
      }
    }
  }
  S.cut();

  // ---------------------------------------------------------------- The port
  cv.layer = 6;
  // Thin beach along the far shore.
  cv.oilPastel(cv.wobble(spline([[764, yh + 6], [778, yh + 40], [803, yh + 72], [812, yh + 118]], 8), 1), mix(P.sand[2], C.haze, 0.2), 3.4, { press: 0.95 });
  // The long quay, with sheds and a round building at its end.
  const quay = rect(786, yh + 186, 968, yh + 206);
  cv.hatch(quay, "oilPastel", mix(C.stone[1], C.shadow, 0.15), { angle: 0, width: 5, spacing: 3, maxLen: 120, over: [-2, 3], cj: 0.02 });
  cv.oilPastel(cv.line(786, yh + 186, 970, yh + 186, 0.6), C.stone[3], 2.2);
  cv.dryBrush(cv.line(790, yh + 208, 970, yh + 208, 0.8), S.dark(P.sea[0], 0.3), 4, { dry: 0.4 });
  // A white ship at the far side of the quay.
  const ship = (x, y, L) => {
    const white = hour === "day" ? P.cloud[6] : hour === "dusk" ? mix(P.cloud[5], P.hot, 0.2) : P.cloud[4];
    cv.hatch([[x - L * 0.5, y - L * 0.09], [x + L * 0.52, y - L * 0.1], [x + L * 0.46, y], [x - L * 0.47, y]], "oilPastel", mix(white, C.shadow, 0.25), { angle: 0, width: 4, spacing: 2.4, maxLen: L, over: [-1, 1] });
    cv.hatch(rect(x - L * 0.4, y - L * 0.2, x + L * 0.36, y - L * 0.09), "oilPastel", white, { angle: 0, width: 3.4, spacing: 2.2, maxLen: L, over: [-1, 1] });
    cv.hatch(rect(x - L * 0.3, y - L * 0.26, x + L * 0.2, y - L * 0.2), "oilPastel", white, { angle: 0, width: 3, spacing: 2, maxLen: L, over: [-1, 1] });
    for (const k of [0.12, 0.17, 0.23]) cv.pencil(cv.line(x - L * 0.38, y - L * k, x + L * 0.34, y - L * k, 0.3), hour === "day" ? S.dark(P.sea[1], 0.2) : P.lamp, 1.4, { press: hour === "day" ? 0.8 : 1 });
    cv.hatch(rect(x - L * 0.12, y - L * 0.36, x - L * 0.04, y - L * 0.26), "oilPastel", P.hot, { angle: 1.5, width: 3, spacing: 2, maxLen: 30, over: [-1, 1] });
  };
  ship(1010, yh + 187, 150);
  for (let x = 800; x < 950; x += R.range(22, 40)) building(S, C, Q, x, yh + 187, R.range(10, 15), { tall: 0.7 });
  lamps();
  S.cut();
  const round = ellipse(946, yh + 178, 20, 13, 0, 18);
  cv.hatch(round, "oilPastel", (x) => (S.light[0] < 946 === x < 946 ? C.stone[3] : mix(C.stone[1], C.shadow, 0.3)), { angle: 0, width: 3.6, spacing: 2.3, maxLen: 40, over: [-1, 1] });
  for (const k of [-5, 0, 5]) cv.pencil(cv.line(928, yh + 178 + k, 964, yh + 178 + k, 0.3), hour === "day" ? S.dark(P.sea[1], 0.25) : P.lamp, 1.3, { press: 0.9 });
  S.cut();
  // Near quay with a yard of small boats.
  const pier = [[coastX(yh + 300) - 6, yh + 296], [884, yh + 300], [888, yh + 314], [coastX(yh + 314) - 6, yh + 314]];
  cv.hatch(pier, "oilPastel", mix(C.stone[2], C.shadow, 0.2), { angle: 0, width: 5, spacing: 3, maxLen: 110, over: [-2, 3], cj: 0.02 });
  cv.group(() => {
    for (let i = 0; i < 54; i++) {
      const x = 800 + R() * 150;
      const y = yh + 232 + R() * 150;
      if (x < coastX(y) + 10 || (y > yh + 290 && y < yh + 322 && x < 896)) continue;
      const k = 0.6 + 0.9 * ((y - yh - 230) / 150);
      cv.oilPastel(cv.line(x - 9 * k, y, x + 9 * k, y - 0.6, 0.3), [P.cloud[6], P.glow, C.wall[0], P.hot][i % 4], 3 * k);
      cv.pencil(cv.line(x, y - 2, x + R.range(-0.6, 0.6), y - 26 * k, 0.3), hour === "night" ? P.cloud[4] : P.ink, 1.3, { press: 0.85 });
      cv.dryBrush(cv.line(x - 8 * k, y + 4 * k, x + 8 * k, y + 4 * k, 0.4), S.dark(P.sea[0], 0.35), 2.4 * k, { dry: 0.6, press: 0.8 });
      if (i % 3 === 0) cv.dot(x, y - 26 * k, 1.3, hour === "day" ? P.ink : P.lamp, { grain: 0.2 });
    }
  });
  S.cut();

  // ---------------------------------------------------------------- The cable car
  const t1 = [884, yh + 206, 158, 1];
  const top1 = [t1[0], t1[1] - t1[2] - 6];
  const top2 = [t2[0], t2[1] - t2[2] * 1 - 4];
  if (t2[0] - 30 < cv.x1) mast(S, C, t2[0], t2[1], t2[2], t2[3]);
  mast(S, C, t1[0], t1[1], t1[2], t1[3]);
  const start = [-330, yh + 300];
  const runs = [cable(start, top1, 0.04, 40), cable(top1, top2, 0.035, 20), cable(top2, [1560, yh + 120], 0.03, 12)];
  const wire = hour === "night" ? mix(C.steel, P.cloud[3], 0.45) : C.steel;
  for (const run of runs) for (const off of [0, 4.5]) cv.pencil(run.map(([x, y]) => [x, y + off]), wire, 1.7, { press: 1.1, span: 0.3 });
  S.cut();
  // Cabins: red, with a pale roof and a row of windows. They go in the two directions.
  const cabin = (ov, x, y, k) => {
    const body = C.cabin;
    ov.pencil([[x, y], [x + 1.5 * k, y + 13 * k]], C.steel, 1.6 * k);
    ov.oilPastel([[x - 7 * k, y - 1], [x + 7 * k, y - 1]], C.steel, 3 * k);
    ov.hatch(rect(x - 10 * k, y + 13 * k, x + 13 * k, y + 33 * k), "oilPastel", body, { angle: 0, width: 4.4 * k, spacing: 2.6 * k, maxLen: 40 * k, over: [-0.5, 0.5] });
    ov.oilPastel([[x - 11 * k, y + 13 * k], [x + 14 * k, y + 13 * k]], hour === "night" ? P.cloud[4] : P.cloud[6], 3.2 * k);
    ov.oilPastel([[x - 8 * k, y + 20 * k], [x + 11 * k, y + 20 * k]], hour === "day" ? S.dark(P.sea[1], 0.35) : P.lamp, 4.6 * k);
    ov.pencil([[x - 10 * k, y + 33 * k], [x + 13 * k, y + 33 * k]], S.dark(body, 0.45), 1.6 * k);
  };
  S.sprites.push({
    seed: 61,
    keep: 6,
    draw(ov, t) {
      // One trip takes about one minute. The cabin goes there and back, and is slow at the two ends.
      const trip = (phase) => {
        const u = (t / 110 + phase) % 1;
        return 0.5 - 0.5 * Math.cos(Math.PI * clamp((u < 0.5 ? u * 2 : 2 - u * 2) * 1.08 - 0.04));
      };
      const sway = (n) => Math.sin(t * 0.9 + n) * 1.2;
      const a = along(runs[0], 0.2 + 0.78 * trip(0.31));
      cabin(ov, a[0] + sway(1), a[1], 1);
      const b = along(runs[0], 0.2 + 0.78 * trip(0.83));
      cabin(ov, b[0] + sway(2), b[1] + 4.5, 1);
      const c = along(runs[1], 0.04 + 0.92 * trip(0.55));
      const k = 1 - 0.38 * clamp((c[0] - top1[0]) / (top2[0] - top1[0]));
      cabin(ov, c[0] + sway(3), c[1], k);
    },
  });

  // A ferry far out and a small sail in the port water. They stay on the water.
  S.sprites.push({
    seed: 62,
    keep: 3,
    draw(ov, t) {
      const lane = cv.x1 + 140 - 790;
      const fx = 790 + ((((t * 5 + 120) % lane) + lane) % lane);
      const fy = yh + 24;
      const white = hour === "night" ? P.cloud[4] : P.cloud[6];
      ov.dryBrush(ov.line(fx - 40, fy + 3, fx - 12, fy + 3, 0.4), S.lit(P.sea[2], 0.5), 2.2, { dry: 0.7, press: 0.8 });
      ov.hatch([[fx - 15, fy - 5], [fx + 17, fy - 5.5], [fx + 13, fy], [fx - 14, fy]], "oilPastel", white, { angle: 0, width: 2.6, spacing: 1.6, maxLen: 40, over: [-0.5, 0.5] });
      ov.oilPastel([[fx - 9, fy - 8], [fx + 7, fy - 8]], S.dark(white, 0.15), 3.6);
      ov.oilPastel([[fx - 2, fy - 12], [fx - 2, fy - 9]], P.hot, 3);
      if (hour !== "day") for (const dx of [-8, -3, 2, 7]) ov.dot(fx + dx, fy - 7, 1.1, P.lamp, { grain: 0.2 });
      const sx = 905 + Math.sin(t * 0.05) * 36;
      const sy = yh + 262 + Math.sin(t * 0.9) * 0.8;
      const cloth = hour === "night" ? P.cloud[4] : hour === "dusk" ? S.lit(P.hot, 0.45) : P.sun;
      const dir = Math.cos(t * 0.05) > 0 ? 1 : -1;
      ov.oilPastel([[sx - 11, sy], [sx + 12, sy]], P.glow, 3.4);
      ov.pencil([[sx, sy], [sx, sy - 30]], P.ink, 1.4);
      ov.hatch([[sx + 2 * dir, sy - 29], [sx + 2 * dir, sy - 4], [sx + 15 * dir, sy - 4]], "oilPastel", cloth, { angle: 1.2 * dir, width: 2.6, spacing: 1.6, maxLen: 30, over: [-0.5, 0.5] });
    },
  });

  // ---------------------------------------------------------------- The terrace
  cv.layer = 7;
  const onSlope = (x, y) => (y > wallY(x) + 24 ? 1 : 0);
  const earthAt = (x, y) => {
    const up = (y - wallY(x) - 24) / 220;
    const grass = sm(0.5, 0.66, fbm(x / 90, y / 34, 51, 3));
    const c = ramp(C.earth, 0.62 - 0.3 * up + (fbm(x / 60, y / 16, 52, 2) - 0.5) * 0.5 + R.gauss() * 0.05);
    return mix(c, ramp(P.land, 0.5 + 0.3 * fbm(x / 30, y / 30, 53, 2)), grass * (hour === "day" ? 0.7 : 0.45));
  };
  const slopeBox = [S.x0, 1040, S.x1, S.bottom];
  cv.scumble(slopeBox, "block", { angle: -0.08, jitter: 0.06, len: [60, 130], width: [14, 24], gap: 0.5, lap: 0.55, mask: onSlope, color: earthAt, cj: 0.02 });
  cv.scumble(slopeBox, "softPastel", { angle: -0.1, jitter: 0.1, len: [26, 76], width: [3.6, 6.4], gap: 3.8, mask: onSlope, color: earthAt, cj: 0.05 });
  cv.scumble(slopeBox, "softPastel", { angle: -1.3, jitter: 0.3, len: [10, 26], width: [2.6, 4.4], gap: 3.2, mask: (x, y) => onSlope(x, y) * sm(0.46, 0.62, fbm(x / 90, y / 34, 51, 3)), color: (x, y) => ramp(P.land, 0.35 + 0.5 * R()), cj: 0.04 });
  // Shade of the pines on the ground.
  cv.scumble(slopeBox, "softPastel", { angle: -0.05, jitter: 0.05, len: [30, 80], width: [3.4, 5.6], gap: 1.9, mask: (x, y) => onSlope(x, y) * sm(0.52, 0.64, fbm((x + y * 0.8) / 150, y / 46, 57, 2)) * sm(700, 420, x), color: (x, y) => mix(earthAt(x, y), C.shadow, 0.55), cj: 0.03 });
  S.cut();
  // The wall of the terrace: stone, with a pale cap.
  const wallTop = [];
  for (let x = S.x0; x <= S.x1 + 40; x += 40) wallTop.push([x, wallY(x)]);
  const wallPoly = [...wallTop, ...wallTop.slice().reverse().map(([x, y]) => [x, y + 30])];
  cv.hatch(wallPoly, "oilPastel", (x, y) => ramp(C.stone, 0.56 - 0.5 * ((y - wallY(x)) / 30) + (vnoise(x / 36, 2, 5) - 0.5) * 0.35), { angle: 0.02, width: 8, spacing: 4.6, maxLen: 170, over: [-6, 8], jitter: 0.006, cj: 0.03 });
  for (let x = S.x0 + R() * 40; x < S.x1; x += R.range(36, 62)) cv.pencil(cv.line(x, wallY(x) + 5, x + R.range(-2, 2), wallY(x) + 29, 0.5), mix(C.stone[0], C.shadow, 0.4), 1.8, { press: 0.8 });
  cv.oilPastel(cv.wobble(wallTop, 0.8), S.lit(C.stone[3], 0.25), 4.4, { span: 0.4 });
  cv.dryBrush(cv.wobble(wallTop.map(([x, y]) => [x, y + 31]), 0.8), mix(C.earth[0], C.shadow, 0.5), 4.4, { press: 1.05, dry: 0.25, span: 0.4 });
  S.cut();
  // A lamp on the wall.
  const [px, py] = [556, wallY(556)];
  cv.charcoal(cv.line(px, py + 4, px - 1, py - 150, 0.6), C.steel, 5, { press: 1.25 });
  cv.pencil(spline([[px - 1, py - 150], [px + 2, py - 168], [px + 18, py - 174], [px + 30, py - 164]], 6), C.steel, 3.4);
  cv.hatch([[px + 23, py - 164], [px + 37, py - 164], [px + 34, py - 150], [px + 26, py - 150]], "oilPastel", hour === "day" ? P.cloud[6] : P.lamp, { angle: 1.5, width: 3, spacing: 2, maxLen: 20, over: [-0.5, 0.5] });
  cv.oilPastel(cv.line(px + 21, py - 166, px + 39, py - 166, 0.2), C.steel, 3);
  if (hour !== "day") {
    for (let i = 0; i < 26; i++) cv.softPastel(cv.line(px + 30 - R.range(8, 60), py - 156 + R.range(-26, 30), px + 30 + R.range(8, 60), py - 156 + R.range(-26, 30), 0.6), P.lamp, 3, { press: 0.5 });
    cv.scumble([px - 80, py - 2, px + 140, py + 34], "softPastel", { angle: 0, jitter: 0.05, len: [14, 40], width: [2.4, 4.4], gap: 2.2, mask: (x) => Math.exp(-(((x - px - 30) / 70) ** 2)), color: S.lit(C.stone[3], 0.4), press: 0.8, cj: 0.03 });
    C.sparks.push([px + 30, py - 157, 4.4]);
  }
  S.cut();

  // Shrubs with flowers along the wall, a bench near the lamp, and flowers in the grass.
  for (const [bx, w, tint] of [[330, 70, P.hot], [760, 86, P.cloud[4]], [-40, 60, P.sun], [1090, 70, P.hot]]) {
    for (let i = 0; i < 110; i++) {
      const x = bx + R.gauss() * w * 0.42;
      const y = wallY(bx) + 44 + R.gauss() * 13 - 16 * Math.exp(-(((x - bx) / (w * 0.5)) ** 2));
      const up = clamp((wallY(bx) + 52 - y) / 40);
      const leaf = ramp(P.land, 0.15 + 0.55 * up + R.gauss() * 0.1);
      cv.dot(x, y, R.range(4.4, 8), hour === "day" ? leaf : mix(P.ink, leaf, 0.55), { grain: 0.45 });
      if (i % 4 === 0) cv.dot(x + R.range(-4, 4), y - R.range(2, 7), R.range(1.6, 2.6), hour === "night" ? mix(tint, P.ink, 0.5) : tint, { grain: 0.3 });
    }
  }
  const [qx, qy] = [640, wallY(640) + 62];
  cv.oilPastel(cv.line(qx - 34, qy - 13, qx + 34, qy - 14, 0.4), ramp(P.wood, 0.75), 5);
  cv.oilPastel(cv.line(qx - 34, qy - 26, qx + 34, qy - 27, 0.4), ramp(P.wood, 0.55), 6);
  for (const dx of [-28, 28]) {
    cv.charcoal(cv.line(qx + dx, qy - 30, qx + dx, qy, 0.3), C.steel, 2.6);
    cv.pencil(cv.line(qx + dx + 5, qy - 13, qx + dx + 6, qy + 2, 0.3), C.steel, 2);
  }
  cv.dryBrush(cv.line(qx - 40, qy + 4, qx + 44, qy + 5, 0.6), mix(C.earth[0], C.shadow, 0.5), 5, { dry: 0.5, press: 0.9 });
  for (let i = 0; i < 260; i++) {
    const x = R.range(S.x0, S.x1);
    const y = R.range(1130, S.bottom);
    if (y < wallY(x) + 40 || fbm(x / 90, y / 34, 51, 3) < 0.5) continue;
    cv.dot(x, y, R.range(1.4, 2.6), hour === "night" ? P.cloud[3] : R() < 0.5 ? P.sun : R() < 0.5 ? P.hot : P.cloud[5], { grain: 0.3 });
  }
  S.cut();
  // Cypress at the right. Pines at the left.
  for (const [x, top, w, seed] of [[1262, 930, 62, 5], [1128, 905, 50, 4], [1196, 842, 78, 3], [966, 948, 58, 1], [1036, 990, 50, 2]]) {
    const foot = wallY(x) + 150 + (seed % 3) * 22;
    cypress(S, x, foot, foot - top, w, seed);
  }
  stonePine(S, { bx: -330, by: S.bottom, cx: -300, cy: 792, rx: 180, ry: 78, s: 0.82, seed: 3 });
  stonePine(S, { bx: 128, by: S.bottom + 10, cx: 52, cy: 742, rx: 228, ry: 100, s: 1.15, seed: 1 });
  // Agave and dry grass at the lower edge.
  for (let i = 0; i < 60; i++) {
    const x = R.range(S.x0, S.x1);
    const y = R.range(1190, S.bottom);
    cv.pencil(cv.line(x, y, x + R.range(-14, 14), y - R.range(16, 44), 1.2), R() < 0.5 ? ramp(P.land, R.range(0.2, 0.8)) : ramp(C.earth, R.range(0.5, 1)), R.range(1.8, 3), { taper: 0.8 });
  }
  S.cut();
  for (const [x, y, s, seed] of [[1100, 1290, 70, 6], [-170, 1318, 84, 5], [806, 1296, 62, 3], [404, 1322, 78, 2], [690, 1340, 112, 1]]) agave(S, C, x, y, s, seed);

  if (hour !== "day") twinkle(S, C.sparks.slice(0, 90), { seed: 7, keep: 6 });
  return S;
}

export default {
  id: "montjuic",
  name: "Montjuïc",
  alt: "Pastel drawing of Barcelona from the hill of Montjuïc: the city grid, the Sagrada Família, the Collserola range, the port and the red cabins of the cable car.",
  frame: { top: 372, bottom: 1333 },
  draw,
};
