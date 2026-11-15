// Bayahibe: a calm bay with a curve of pale sand, coconut palms, fishing boats and a small wood pier.
import { clamp, ellipse, fbm, hex, mix, ramp, sm, spline, vnoise } from "../engine.mjs";
import { birds, buoy, crab, gull, house, lowClouds, onLayer, paintBeach, paintRidge, paintSea, paintSky, palm, palmMark, pelican, sailer, scene, shoreLine, skyClouds, twinkle, yola } from "../kit.mjs";

const yh = 800;

// Boat paint and palm thatch. One set for each hour.
const EXTRA = {
  day: { boat: ["#fff6e6", "#2b78a8", "#ffd45e", "#ee6650", "#36a8a8"], thatch: ["#6a4a3a", "#b08a5a", "#e6c890"] },
  dusk: { boat: ["#f8c49c", "#3b4a9c", "#e0a05a", "#c95a5a", "#3f8aa8"], thatch: ["#2a2250", "#6a4a6a", "#d0906a"] },
  night: { boat: ["#8f9ad0", "#232d6e", "#6a6a9a", "#5a3a6a", "#2a5a94"], thatch: ["#0f143c", "#2a2f66", "#5a5c98"] },
};

// Rows of small cloud dabs high in the sky, and thin flat bars of cloud near the horizon.
function fleece(S) {
  const { cv, P, R, hour, sun } = S;
  cv.layer = 1;
  const h = yh - cv.y0;
  const y1 = cv.y0 + h * 0.7;
  const patch = (x, y) => sm(0.5, 0.64, fbm(x / 430, (y - cv.y0) / 160, 77, 3));
  const row = (x, y) => 0.5 + 0.5 * Math.sin((x * 0.34 + (y - cv.y0)) / 11 + 5 * fbm(x / 210, y / 210, 78, 2));
  const clear = (x, y) => (sun ? sm(sun.r * 2, sun.r * 4.5, Math.hypot(x - sun.x, y - sun.y)) : 1);
  const tone = (x, y) => {
    const low = clamp((y - cv.y0) / (y1 - cv.y0));
    if (hour === "day") return mix(ramp(P.cloud, 0.8 + 0.2 * R()), S.skyAt(x, y), 0.3);
    // The low sun lights the dabs near the horizon. High dabs stay dark.
    if (hour === "dusk") return mix(ramp(P.cloud, 0.1 + 0.86 * low ** 1.4 + R.gauss() * 0.06), S.skyAt(x, y), 0.15);
    return mix(ramp(P.cloud, 0.28 + 0.22 * R()), S.skyAt(x, y), 0.45);
  };
  cv.scumble([S.x0, S.top, S.x1, y1], "softPastel", { angle: -0.25, jitter: 0.3, len: [14, 30], width: [6, 11], gap: 0.9, lap: 0.8, mask: (x, y) => patch(x, y) * sm(0.35, 0.7, row(x, y)) * sm(y1, y1 - 90, y) * clear(x, y), color: tone, cj: 0.03 });
  S.cut();
  if (hour === "dusk") {
    // Orange light along the horizon, strongest at the sun.
    cv.scumble([sun.x - 560, yh - 170, sun.x + 560, yh + 6], "softPastel", { angle: 0, jitter: 0.05, len: [40, 110], width: [4, 8], gap: 1.1, mask: (x, y) => Math.exp(-(((x - sun.x) / 340) ** 2)) * sm(yh - 170, yh - 24, y) * sm(sun.r * 0.95, sun.r * 1.6, Math.hypot(x - sun.x, y - sun.y)) * 0.9, color: (x) => mix(P.hot, P.lamp, 0.3 + 0.55 * Math.exp(-(((x - sun.x) / 150) ** 2))), cj: 0.03 });
    S.cut();
  }
  // Flat bars: dark above, lit from below at dusk.
  const bars = [[yh - 0.2 * h, 15, 31], [yh - 0.31 * h, 11, 32], [yh - 0.12 * h, 9, 33]];
  for (const [by, bh, seed] of bars) {
    const mid = (x) => by + 26 * (fbm(x / 500, 1.5, seed, 2) - 0.5);
    const body = (x, y) => sm(bh, bh * 0.25, Math.abs(y - mid(x))) * sm(0.42, 0.58, fbm(x / 260, 2.5, seed + 3, 2)) * clear(x, y);
    const color = (x, y) => {
      const under = sm(-bh * 0.2, bh * 0.8, y - mid(x));
      if (hour === "day") return mix(ramp(P.cloud, 0.55 + 0.4 * (1 - under)), S.skyAt(x, y), 0.4);
      if (hour === "dusk") return mix(ramp(P.cloud, 0.12 + 0.75 * under), S.skyAt(x, y), 0.12);
      return mix(ramp(P.cloud, 0.12 + 0.2 * (1 - under)), S.skyAt(x, y), 0.35);
    };
    cv.scumble([S.x0, by - bh - 16, S.x1, by + bh + 16], "softPastel", { angle: -0.03, jitter: 0.06, len: [40, 120], width: [4, 8], gap: 0.8, lap: 0.8, mask: body, color, cj: 0.03 });
  }
  S.cut();
  cv.layer = 2;
}

// Wood pier seen from the side. It goes from the left edge out to x = 318. The near end is at the left.
function pier(S) {
  const { cv, P, R, hour } = S;
  const xa = Math.min(S.x0, -300);
  const xb = 318;
  const far = (x) => clamp((x - xa) / (xb - xa));
  const deckY = (x) => 1078 - 92 * far(x);
  const k = (x) => 1.75 - 0.85 * far(x);
  const water = (x) => deckY(x) + 44 * k(x);
  const piles = [];
  for (let x = xb - 8; x > xa; x -= 62 * k(x)) piles.push(x);
  // Shadow of the deck on the water.
  cv.scumble([xa, 1010, xb + 10, 1190], "dryBrush", { angle: 0, jitter: 0.02, len: [30, 80], width: [3, 6], gap: 1.1, mask: (x, y) => sm(26, 6, Math.abs(y - water(x) - 12 * k(x))) * (0.5 + 0.6 * sm(0.3, 0.6, fbm(x / 50, y / 5, 71, 2))), color: S.dark(P.sea[0], 0.35), cj: 0.03, opts: { dry: 0.7 } });
  for (const x of piles.slice().reverse()) {
    const s = k(x);
    const [top, foot] = [deckY(x), water(x)];
    // Back pile, then front pile, then their broken image in the water.
    cv.charcoal(cv.line(x + 15 * s, top - 3 * s, x + 14 * s, foot - 7 * s, 0.5), ramp(P.wood, 0.1), 5 * s, { press: 1.2 });
    for (let i = 0; i < 7; i++) {
      const y = foot + (6 + i * 9) * s + R.range(-2, 2);
      const len = (10 - i * 0.8) * s;
      cv.dryBrush(cv.line(x - len + R.range(-3, 3), y, x + len + R.range(-3, 3), y, 0.4), S.dark(P.sea[0], 0.4), Math.max(1.6, 4.4 * s), { press: 0.9 - i * 0.07, dry: 0.7 });
    }
    cv.charcoal(cv.line(x, top, x - 1, foot, 0.5), ramp(P.wood, S.light[0] < x ? 0.3 : 0.05), 7 * s, { press: 1.3 });
    cv.pencil(cv.line(x - 3 * s, top, x - 4 * s, foot - 2, 0.4), ramp(P.wood, 0.7), 1.6 * s, { press: 0.8 });
    cv.oilPastel(cv.line(x - 5 * s, foot, x + 5 * s, foot, 0.3), S.lit(P.glow, 0.4), 1.6, { press: 0.8 });
  }
  // Deck: one board at a time.
  for (let x = xa; x < xb; ) {
    const s = k(x);
    const w = R.range(16, 24) * s;
    cv.oilPastel(cv.line(x, deckY(x), x + w - 1.5, deckY(x + w), 0.3), ramp(P.wood, R.range(0.45, 0.85)), 8 * s, { cap: 0.2 });
    x += w;
  }
  const edge = [];
  for (let x = xa; x <= xb + 1; x += 30) edge.push([x, deckY(x)]);
  cv.pencil(edge.map(([x, y]) => [x, y - 4.2 * k(x)]), S.lit(P.wood[3], 0.35), 2, { press: 0.9, span: 0.2 });
  cv.charcoal(edge.map(([x, y]) => [x, y + 4.6 * k(x)]), P.wood[0], 3, { press: 1.2, span: 0.2 });
  // Posts with a rope. Pelicans sit on two of them.
  const posts = piles.filter((_, i) => i % 2 === 1);
  const tops = posts.map((x) => [x, deckY(x) - 30 * k(x)]);
  for (const [x, y] of tops) {
    cv.charcoal(cv.line(x, deckY(x) - 2, x, y, 0.3), P.wood[0], 5 * k(x), { press: 1.2 });
    cv.oilPastel(cv.line(x - 3 * k(x), y, x + 3 * k(x), y, 0.2), ramp(P.wood, 0.9), 2);
  }
  for (let i = 0; i + 1 < tops.length; i++) {
    const [a, b] = [tops[i], tops[i + 1]];
    const rope = [];
    for (let t = 0; t <= 1.001; t += 0.125) rope.push([a[0] + (b[0] - a[0]) * t, a[1] + 5 + (b[1] - a[1]) * t + 9 * k(a[0]) * Math.sin(Math.PI * t)]);
    cv.pencil(rope, ramp(P.sand, 0.55), 1.6, { press: 0.85 });
  }
  // Ladder at the far end.
  const [lx, ly] = [xb - 2, deckY(xb)];
  for (const dx of [0, 9]) cv.pencil(cv.line(lx + dx, ly - 14, lx + dx + 1, ly + 36, 0.3), P.wood[0], 2);
  for (let i = 0; i < 5; i++) cv.pencil([[lx, ly - 6 + i * 9], [lx + 9, ly - 6 + i * 9]], P.wood[0], 1.6);
  // Lamp post.
  const px = xb - 26;
  const [bx, by] = [px + 12, deckY(px) - 82];
  cv.charcoal(cv.line(px, deckY(px) - 2, px, deckY(px) - 88, 0.5), P.ink, 3.4);
  cv.pencil(spline([[px, deckY(px) - 88], [px + 5, deckY(px) - 95], [px + 12, deckY(px) - 90]], 5), P.ink, 2.2);
  cv.dot(bx, by, 4.6, hour === "day" ? P.glow : P.lamp, { grain: 0.2 });
  if (hour !== "day") {
    for (let i = 0; i < 12; i++) cv.softPastel(cv.line(bx - R.range(8, 44), by + R.range(-18, 18), bx + R.range(8, 44), by + R.range(-18, 18), 0.5), P.lamp, 2.6, { press: 0.5 });
    for (let i = 0; i < 26; i++) {
      const t = R();
      const len = (5 + 22 * t) * R.range(0.5, 1.2);
      const cx = bx + 30 + R.gauss() * (6 + 20 * t);
      const y = water(bx) + 8 + 110 * t;
      cv.oilPastel(cv.line(cx - len / 2, y, cx + len / 2, y, 0.4), P.lamp, 1.6 + 2.4 * t, { press: R.range(0.7, 1) });
    }
  }
  S.cut();
  if (tops.length > 1) pelican(S, tops[1][0], tops[1][1], 44 * k(tops[1][0]), 1);
  if (tops.length > 3) pelican(S, tops[3][0], tops[3][1], 44 * k(tops[3][0]), -1);
  return { end: [px, deckY(px) - 88], tops, k };
}

// Beach shelter with a roof of palm leaves.
function palapa(S, X, x, y, s) {
  const { cv, P, R, hour } = S;
  const lightLeft = S.light[0] < x;
  cv.hatch(ellipse(x + (lightLeft ? 0.3 : -0.3) * s, y + 0.03 * s, 0.6 * s, 0.07 * s), "softPastel", S.dark(P.sand[0], 0.4), { angle: 0, width: 5, spacing: 3.2, maxLen: 80, cj: 0.03 });
  cv.charcoal(cv.line(x, y, x - 1, y - 0.8 * s, 0.5), X.thatch[0], 0.055 * s, { press: 1.3 });
  cv.pencil(cv.line(x - 0.02 * s, y, x - 0.03 * s, y - 0.7 * s, 0.4), X.thatch[1], 0.016 * s, { press: 0.8 });
  const apex = [x, y - 1.14 * s];
  const rim = y - 0.7 * s;
  const half = (dir, tone) => {
    const poly = [apex, [x + dir * 0.64 * s, rim], [x + dir * 0.5 * s, rim + 0.05 * s], [x, rim + 0.07 * s]];
    cv.hatch(poly, "softPastel", (px, py) => ramp(X.thatch, tone + 0.25 * ((rim - py) / (0.44 * s)) + R.gauss() * 0.08), { angle: dir * 0.62 + Math.PI / 2 - dir * 0.9, width: 0.035 * s, spacing: 0.018 * s, maxLen: 0.4 * s, over: [-1, 3], cj: 0.04, press: 1.1 });
  };
  half(-1, lightLeft ? 0.6 : 0.2);
  half(1, lightLeft ? 0.2 : 0.6);
  // Leaf ends hang from the rim.
  for (let i = 0; i <= 26; i++) {
    const px = x - 0.64 * s + (1.28 * s * i) / 26 + R.range(-2, 2);
    const drop = 0.05 * s * (1 - Math.abs(px - x) / (0.7 * s)) + 0.03 * s;
    cv.pencil([[px, rim - 2], [px + R.range(-2, 2), rim + drop + R.range(0, 0.05 * s)]], ramp(X.thatch, R.range(0.1, 0.7)), 0.018 * s, { taper: 0.6 });
  }
  cv.dot(apex[0], apex[1] - 2, 0.03 * s, X.thatch[0]);
  // Table and a lantern.
  cv.oilPastel(cv.line(x - 0.2 * s, y - 0.2 * s, x + 0.2 * s, y - 0.2 * s, 0.3), X.thatch[1], 0.03 * s);
  cv.dot(x + 0.09 * s, y - 0.56 * s, 0.035 * s, hour === "day" ? P.sea[2] : P.lamp, { grain: 0.2 });
  if (hour !== "day") for (let i = 0; i < 10; i++) cv.softPastel(cv.line(x + 0.09 * s - R.range(0.06, 0.4) * s, y - 0.56 * s + R.range(-0.16, 0.16) * s, x + 0.09 * s + R.range(0.06, 0.4) * s, y - 0.56 * s + R.range(-0.16, 0.16) * s, 0.5), P.lamp, 2.6, { press: 0.5 });
  S.cut();
}

// Frigate bird: long bent wings and a forked tail. It soars in slow circles.
function frigate(ov, color, x, y, s, bank, opts) {
  const w = 1.4 + s * 0.06;
  for (const d of [-1, 1]) {
    const lift = 0.2 + bank * d * 0.16;
    ov.pencil([[x, y], [x + d * 0.42 * s, y - lift * s], [x + d * s, y + (0.1 - bank * d * 0.2) * s]], color, w, { taper: 0.7, ...opts });
    ov.pencil([[x, y + 0.04 * s], [x + d * 0.1 * s, y + 0.46 * s]], color, w * 0.7, { taper: 0.8, ...opts });
  }
  ov.dot(x, y + 0.03 * s, 0.07 * s, color, { grain: 0.3, ...opts });
}

// Catamaran with a tall sail. It goes across the far water.
function catamaran(S, { y, L, speed, dir, seed, start }) {
  const { cv, P, hour } = S;
  const span = cv.x1 - cv.x0 + L * 4;
  const sail = hour === "night" ? P.cloud[4] : hour === "dusk" ? S.lit(P.hot, 0.5) : P.sun;
  const hull = hour === "day" ? P.glow : S.dark(P.glow, 0.35);
  S.sprites.push({
    seed: 760 + seed,
    keep: 3,
    draw(ov, t) {
      const u = (((start - cv.x0 + L * 2 + dir * speed * t) % span) + span) % span;
      const bx = cv.x0 - L * 2 + u;
      const by = y + Math.sin(t * 0.9 + seed) * L * 0.01;
      const p = (a, b) => [bx + a * L * dir, by + b * L];
      const lw = (k) => Math.max(1.2, k * L);
      for (let i = 0; i < 5; i++) {
        const off = Math.sin(i * 1.7 + t * 1.5) * 0.04 * L;
        ov.dryBrush(ov.line(bx + off - 0.3 * L, by + (0.06 + i * 0.06) * L, bx + off + 0.3 * L, by + (0.06 + i * 0.06) * L, 0.4), S.dark(P.sea[0], 0.25), lw(0.028), { press: 0.85 - i * 0.12, dry: 0.7 });
      }
      // Two thin hulls and a low cabin.
      ov.oilPastel([p(-0.52, -0.05), p(0.5, -0.07), p(0.6, -0.11)], hull, lw(0.05));
      ov.oilPastel([p(-0.5, 0.0), p(0.52, -0.02)], S.dark(hull, 0.35), lw(0.03));
      ov.oilPastel([p(-0.2, -0.13), p(0.16, -0.14)], S.lit(hull, 0.3), lw(0.07));
      ov.charcoal([p(0.02, -0.12), p(0.02, -1.5)], P.ink, lw(0.016));
      ov.hatch([p(0.05, -1.46), p(0.05, -0.24), p(-0.5, -0.22)], "oilPastel", sail, { angle: -1.25 * dir, width: lw(0.045), spacing: lw(0.026), maxLen: L * 1.3, over: [-1, 1], cj: 0.02 });
      ov.hatch([p(0.09, -1.3), p(0.09, -0.2), p(0.56, -0.14)], "oilPastel", S.dark(sail, 0.14), { angle: 1.15 * dir, width: lw(0.045), spacing: lw(0.026), maxLen: L * 1.3, over: [-1, 1], cj: 0.02 });
      ov.oilPastel([p(0.04, -0.8), p(-0.3, -0.56)], P.hot, lw(0.04));
      if (hour !== "day") ov.dot(...p(0.02, -1.52), lw(0.03), P.lamp, { grain: 0.2 });
    },
  });
}

function draw(cv, hour) {
  const light = { day: [-240, -380], dusk: [372, yh - 30], night: [300, 300] }[hour];
  const S = scene(cv, hour, { seed: 808, yh, light, refl: { day: 0.26, dusk: 0.66, night: 0.45 }[hour], glowR: hour === "day" ? 520 : 290 });
  const { P, R } = S;
  const X = Object.fromEntries(Object.entries(EXTRA[hour]).map(([key, list]) => [key, list.map(hex)]));
  if (hour === "night") {
    S.sun = { x: 300, y: yh - clamp((yh - cv.y0) * 0.55, 190, 480), r: 27, moon: true };
    S.light = [S.sun.x, S.sun.y];
  } else if (hour === "dusk") S.sun = { x: 372, y: yh - 30, r: 36 };

  const clouds = [...lowClouds(S, 5), ...skyClouds(S, [[790, 600, 300, 150, 8, 21], [150, 500, 220, 110, 6, 22]])];
  paintSky(S, clouds, { cirrus: 12, stars: 1300 });
  fleece(S);
  birds(S, { n: 14, box: [S.sx(0.2), S.sy(0.45), S.sx(0.9), yh - 110], size: [4, 11], seed: 1 });
  // Frigate birds high above the bay.
  const soar = [0.22, 0.55, 0.8].map((fx, i) => ({ cx: S.sx(fx), cy: S.sy(0.3 + 0.12 * (i % 2)), rx: 90 + i * 30, ry: 26 + i * 6, s: 26 - i * 4, w: (i % 2 ? -1 : 1) * (0.1 + i * 0.02), ph: i * 2.4 }));
  S.sprites.push({
    seed: 51,
    keep: 1,
    draw(ov, t) {
      for (const b of soar) {
        const a = b.ph + t * b.w;
        frigate(ov, hour === "night" ? P.cloud[4] : P.ink, b.cx + Math.cos(a) * b.rx, b.cy + Math.sin(a) * b.ry, b.s * (1 + 0.12 * Math.sin(a)), Math.cos(a) * Math.sign(b.w), { keep: 1 });
      }
    },
  });

  // Far island at the left: Isla Saona, low and pale.
  const base = yh + 2;
  const isle = (x) => 15 * sm(430, 120, x) * (0.7 + 0.6 * vnoise(x / 70, 2, 5)) + 3 * vnoise(x / 14, 3, 5);
  paintRidge(S, { h: isle, base, x0: S.x0, x1: 440, top: yh - 40, seed: 21, haze: 0.5, dab: [4, 9] });
  // Green point at the right, with the village at the water.
  const point = (x) => 122 * sm(470, 850, x) ** 0.8 * (0.84 + 0.3 * vnoise(x / 110, 1.7, 8)) + 5 * vnoise(x / 12, 3, 8) * sm(450, 490, x);
  const landAt = paintRidge(S, { h: point, base, x0: 450, x1: S.x1, top: yh - 160, seed: 23, haze: 0.12, dab: [6, 14] });
  const homes = [];
  for (let i = 0; i < (20 * (S.x1 - 540)) / 490; i++) {
    const x = R.range(545, S.x1);
    homes.push([x, base - point(x) * R.range(0.02, 0.3), R.range(7, 12)]);
  }
  const marks = [];
  for (let i = 0; i < (26 * (S.x1 - 500)) / 530; i++) {
    const x = R.range(505, S.x1);
    marks.push([x, R.range(0.25, 1.02), R.range(13, 24)]);
  }
  homes.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s] of homes) house(S, x, y, s, 0.14);
  for (const [x, rel, s] of marks) palmMark(S, x, base - point(x) * rel, s, mix(landAt(x, base - point(x)), S.skyAt(x, yh - 8), 0.1));
  // The small wood church of the village: pale walls, a blue roof and a short tower.
  const [kx, ky] = [652, base - 3];
  const pale = hour === "day" ? P.glow : S.dark(P.glow, hour === "dusk" ? 0.25 : 0.5);
  cv.hatch([[kx - 13, ky], [kx + 13, ky], [kx + 13, ky - 13], [kx - 13, ky - 13]], "oilPastel", pale, { angle: 0, width: 4, spacing: 2.4, maxLen: 30, over: [-0.5, 0.5] });
  cv.hatch([[kx - 15, ky - 12], [kx + 15, ky - 12], [kx, ky - 24]], "oilPastel", X.boat[1], { angle: 0, width: 3, spacing: 2, maxLen: 30, over: [-0.5, 0.5] });
  cv.oilPastel([[kx + 9, ky - 12], [kx + 9, ky - 30]], pale, 6, { cap: 0.2 });
  cv.pencil([[kx + 5.5, ky - 30], [kx + 9, ky - 39], [kx + 12.5, ky - 30]], X.boat[1], 2.4);
  cv.dot(kx - 3, ky - 6, 1.8, hour === "day" ? S.dark(pale, 0.6) : P.lamp, { grain: 0.2 });
  // A pale strip of sand below the point.
  cv.oilPastel(cv.line(530, base - 1, S.x1, base - 2, 0.6), S.lit(P.sand[2], 0.1), 3, { span: 0.2 });
  S.cut();
  const farLights = [];
  for (let i = 0; i < 18; i++) farLights.push([S.x0 + 30 + R() * (400 - S.x0), base - 2 - R() * 9, R.range(1.2, 2.2)]);
  if (hour !== "day") {
    for (const [x, y, r] of farLights) cv.dot(x, y, r * 0.8, P.lamp, { grain: 0.2 });
    twinkle(S, [...farLights, ...homes.filter((_, i) => i % 2 === 0).map(([x, y, s]) => [x, y - s * 0.4, 1.8])], { seed: 2, keep: 2 });
  }
  S.cut();

  paintSea(S, { y1: 1262, glitterTo: 1150 });
  // Village lights on the water.
  if (hour !== "day") for (const [x] of homes) cv.softPastel(cv.line(x + R.range(-2, 2), base + 4, x + R.range(-3, 3), base + R.range(14, 44), 0.6), P.lamp, 2.4, { press: 0.55 });
  S.cut();
  catamaran(S, { y: yh + 30, L: 58, speed: 8, dir: 1, seed: 1, start: 420 });
  sailer(S, { y: yh + 10, L: 22, speed: 4, dir: -1, seed: 4, x: 860 });
  // Pelicans glide low over the water, one behind the other.
  S.sprites.push({
    seed: 53,
    keep: 3,
    draw(ov, t) {
      const span = cv.x1 - cv.x0 + 400;
      const lead = cv.x1 + 200 - ((t * 34) % span);
      for (let i = 0; i < 4; i++) {
        const x = lead + i * 46;
        const y = yh + 44 + i * 6 + Math.sin(t * 0.7 + i) * 5;
        const flap = Math.sin(t * 0.5 + i * 0.4) > 0.55 ? Math.sin(t * 5 + i) : -0.35;
        gull(ov, hour === "night" ? P.cloud[4] : P.ink, x, y, 15, flap);
        ov.pencil([[x + 6, y + 1], [x - 8, y + 2], [x - 15, y + 6]], hour === "night" ? P.cloud[4] : P.ink, 2.6, { taper: 0.6 });
      }
    },
  });

  const dock = pier(S);
  // Flags on a line at the end of the pier. They move in the wind.
  const [fx, fy] = dock.end;
  cv.pencil([[fx, fy], [fx - 64, fy + 34]], P.ink, 1.3, { press: 0.8 });
  S.sprites.push({
    seed: 57,
    keep: 4,
    draw(ov, t) {
      for (let i = 1; i <= 5; i++) {
        const x = fx - i * 11;
        const y = fy + i * 5.8;
        const wave = Math.sin(t * 3.2 - i * 0.9);
        ov.oilPastel([[x, y], [x - 4 + wave * 4, y + 6], [x - 2 + wave * 7, y + 12]], X.boat[i % 5], 5.5, { taper: 0.5, cap: 0.3 });
      }
    },
  });

  // Boats at anchor. Only a few: the beach is the subject.
  yola(S, { x: 452, y: 846, L: 36, body: X.boat[3], trim: X.boat[0] });
  yola(S, { x: 660, y: 838, L: 28, body: X.boat[1], trim: X.boat[2], dir: -1 });
  yola(S, { x: 846, y: 886, L: 62, body: X.boat[4], trim: X.boat[0], dir: -1 });
  for (const [x, y, s] of [[540, 900, 3], [760, 960, 4.4], [420, 1010, 4.6], [900, 1000, 3.4]]) buoy(S, x, y, s);
  // The white boat rocks at its anchor. It is on the clear layer.
  S.sprites.push({
    seed: 61,
    keep: 4,
    draw(ov, t) {
      const So = onLayer(S, ov);
      const [bx, by] = [612 + Math.sin(t * 0.45) * 4, 992 + Math.sin(t * 1.25) * 1.8];
      yola(So, { x: bx, y: by, L: 150, body: X.boat[0], trim: X.boat[4] });
      // Its line goes to a float.
      ov.pencil(spline([[bx + 80, by - 26], [bx + 104, by - 2], [712, 1000 + Math.sin(t * 1.25 + 1) * 1.5]], 6), P.ink, 1.6, { press: 0.8 });
      ov.dot(716, 1000 + Math.sin(t * 1.25 + 1) * 1.5, 4, P.hot, { grain: 0.3 });
    },
  });

  cv.layer = 5;
  const shore = shoreLine(S, [[-270, 1238], [0, 1214], [260, 1186], [520, 1172], [760, 1142], [960, 1082], [1120, 1008], [1270, 930], [1430, 872]]);
  const { shoreY } = paintBeach(S, shore);
  // A line of dry weed where the last high water stopped, and small ridges in the sand.
  cv.scumble([S.x0, 860, S.x1, S.bottom], "pencil", { angle: -0.1, jitter: 0.5, len: [5, 14], width: [1.6, 2.8], gap: 1.6, mask: (x, y) => sm(9, 2, Math.abs(y - shoreY(x) - 52 - 10 * vnoise(x / 60, 1, 9))) * sm(0.35, 0.6, vnoise(x / 26, 2, 9)), color: mix(P.land[0], P.sand[0], 0.45), cj: 0.05 });
  cv.scumble([S.x0, 900, S.x1, S.bottom], "softPastel", { angle: -0.1, jitter: 0.1, len: [16, 44], width: [2, 3.6], gap: 3.4, mask: (x, y) => sm(60, 110, y - shoreY(x)) * sm(0.45, 0.62, fbm(x / 120, y / 30, 47, 2)), color: (x, y) => S.lit(ramp(P.sand, 0.8), 0.25), cj: 0.03 });
  S.cut();
  // Small boats on the far sand.
  for (const [i, x] of [1100, 1168, 1250, 1340, 1430].entries()) yola(S, { x, y: shoreY(x) + 16 + (i % 2) * 8, L: 62 - i * 6, body: X.boat[(i + 1) % 5], trim: X.boat[(i + 3) % 5], dir: i % 2 ? 1 : -1, beached: true, lamp: false });
  palapa(S, X, 936, shoreY(936) + 70, 150);
  yola(S, { x: 736, y: shoreY(736) + 84, L: 176, body: X.boat[1], trim: X.boat[2], dir: -1, beached: true, lamp: false });
  // Tracks from the water to the shelter.
  for (let i = 0; i < 9; i++) {
    const x = 860 + i * 8 + R.range(-3, 3);
    const y = shoreY(860) + 16 + i * 8 + (i % 2) * 7;
    for (const a of [-0.5, 0, 0.5]) cv.pencil([[x, y], [x + Math.cos(a + 0.4) * 7, y + Math.sin(a + 0.4) * 7]], S.dark(P.sand[0], 0.4), 1.5, { press: 0.8 });
  }
  // The large boat on the near sand, with its line to a stake.
  yola(S, { x: 430, y: 1296, L: 300, body: X.boat[4], trim: X.boat[2], beached: true, lamp: false });
  cv.pencil(spline([[584, 1240], [640, 1284], [690, 1290]], 6), P.ink, 2);
  cv.charcoal(cv.line(690, 1298, 692, 1266, 0.4), P.wood[0], 5);
  crab(S, 760, 1278);
  // Coconuts and dry leaves on the sand.
  for (const [x, y] of [[236, 1250], [252, 1258], [905, 1262], [1150, 1240], [-80, 1290]]) {
    cv.dot(x, y, 6.5, ramp(P.wood, 0.15), { grain: 0.4 });
    cv.dot(x - 2, y - 2, 2.4, ramp(P.wood, 0.6), { grain: 0.4 });
  }
  S.cut();

  // Coconut palms. They lean over the water. A tall sky makes them taller.
  cv.layer = 6;
  const tall = clamp((yh - cv.y0) / 360, 1, 2.1);
  const big = clamp(tall, 1, 1.15);
  const crown = (y) => yh - (yh - y) * tall;
  // In a narrow window the two near palms come in from the edges.
  const [lx, rx] = [Math.max(26, cv.x0 + 180), Math.min(992, cv.x1 - 180)];
  const [lb, rb] = [Math.max(-156, cv.x0 - 50), Math.min(1156, cv.x1 + 40)];
  palm(S, { bx: 1262, by: 1170, cx: 1196, cy: crown(566), s: 0.7, back: 1 });
  palm(S, { bx: -310, by: 1300, cx: -236, cy: crown(654), s: 0.72, back: 1 });
  palm(S, { bx: rb, by: 1326, cx: rx, cy: crown(604), s: 0.92 * big });
  palm(S, { bx: lb, by: 1345, cx: lx, cy: crown(646), s: 0.9 * big });
  // Grass at the palm feet and sea grape at the right corner.
  for (const [gx, gy] of [[lb + 10, 1326], [rb - 10, 1316]]) {
    for (let i = 0; i < 46; i++) {
      const x = gx + R.gauss() * 56;
      const y = gy + R.range(-14, 12);
      cv.pencil(cv.line(x, y, x + R.range(-18, 18), y - R.range(18, 54), 1.5), ramp(P.land, R.range(0.05, 0.75)), R.range(2, 3.6), { taper: 0.8 });
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = 1250 + R.gauss() * 80;
    const y = 1296 + R.gauss() * 34;
    if (y < 1216 + (1340 - x) * 0.3) continue;
    cv.dot(x, y, R.range(6, 12), ramp(P.land, 0.25 + 0.5 * R() - (y - 1260) / 300), { grain: 0.45 });
  }
  return S;
}

export default { id: "bayahibe", name: "Bayahibe", alt: "Pastel drawing of a calm bay with pale sand, coconut palms, fishing boats, a small wood pier and a green point with a village.", frame: { top: 440, bottom: 1333 }, draw };
