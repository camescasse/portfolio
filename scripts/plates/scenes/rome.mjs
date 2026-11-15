// Rome: the Castel Sant'Angelo from a high terrace, across the roofs and the Tiber.
// The round castle with the bronze angel, the Ponte Sant'Angelo and its statues, the dome of St Peter's far away.
// Umbrella pines and a stone balustrade are in front.
import { clamp, ellipse, fbm, hex, mix, ramp, rect, rng, sm, spline, vnoise } from "../engine.mjs";
import { birds, lowClouds, paintSky, scene, skyClouds, twinkle } from "../kit.mjs";

const yh = 800;
// Center of the castle and the radius of its drum.
const [CX, DR] = [530, 150];
// The Tiber: the far edge and the near edge of the water at x. The river comes nearer at the left.
const yFar = (x) => 1024 - 0.02 * (x - 500);
const yNear = (x) => 1112 - 0.055 * (x - 500);
// Height of the river wall on the far bank.
const wallH = (x) => 33 + (500 - x) * 0.012;
// The bridge: its far end and its near end on the water, and the height of the parapet at t (0 far, 1 near).
const BF = [472, yFar(472)];
const BN = [196, yNear(196) + 8];
const bridgeH = (t) => 33 + 17 * t;
// The five arches: start, end and height of the top, as parts of the bridge.
const ARCHES = [[0.03, 0.13, 0.5], [0.16, 0.345, 0.68], [0.375, 0.56, 0.68], [0.59, 0.775, 0.68], [0.805, 0.9, 0.5]];
// Lamps on the river road, at equal distances.
const lampX = (k) => 20 + 64 * k;

// Extra color lists for this place. Each list goes from dark to light.
const HEX = {
  day: {
    terra: ["#7c3f38", "#b0583f", "#d67e56", "#eca678"],
    ochre: ["#b9773f", "#e0a462", "#f3cd92", "#fdeccb"],
    trav: ["#5f6c94", "#98a3bf", "#d3d3d0", "#f8f1e2"],
    pine: ["#10243a", "#1b4444", "#2c6a4a", "#5a9a54", "#a4c672"],
    hills: ["#5f80c4", "#86a4d8", "#b6cbe6"],
    bark: ["#3a2a44", "#7a4a46", "#b87a5c", "#e6b088"],
    castle: ["#5e3340", "#93503f", "#c27d52", "#e6ad78"],
    river: ["#27607a", "#3f8f8c", "#7cbf9f", "#c6e4c4"],
  },
  dusk: {
    terra: ["#4a2a5c", "#8a405c", "#d2664a", "#f8a05c"],
    ochre: ["#5a4078", "#a8607a", "#ee9c6c", "#ffd48c"],
    trav: ["#3f3c80", "#7c6298", "#d4948c", "#fdd6a2"],
    pine: ["#10123a", "#1a2452", "#27425a", "#486a58", "#d08c4c"],
    hills: ["#4f4494", "#8460a4", "#c67e9c"],
    bark: ["#1c1a48", "#4a2f5c", "#a85a5a", "#f29c66"],
    castle: ["#3a2458", "#7a3a5a", "#c9603f", "#f8a455"],
    river: ["#343488", "#6a58a0", "#cc7c8c", "#fbc692"],
  },
  night: {
    terra: ["#10153f", "#1b2560", "#2c3880", "#4353a2"],
    ochre: ["#141b50", "#222e74", "#374696", "#5868b4"],
    trav: ["#18205a", "#2a3884", "#5060ac", "#98a4dc"],
    pine: ["#05071e", "#0a0f2e", "#111a44", "#1a2c5a", "#2c4872"],
    hills: ["#121a4e", "#1b2868", "#283a82"],
    bark: ["#080a26", "#141a48", "#2a3472", "#4a58a0"],
    // Lamps light the castle at night.
    castle: ["#4a2450", "#a84e36", "#ea9236", "#ffcf6c"],
    river: ["#0c1238", "#152058", "#21367a", "#365898"],
  },
};

const colors = (hour) => Object.fromEntries(Object.entries(HEX[hour]).map(([k, v]) => [k, v.map(hex)]));

// Light and shade for a wall color. k is 1 for the face that looks at the light.
function face(S, c, k) {
  if (S.hour === "dusk") return k > 0.5 ? mix(c, S.P.sun, 0.22 * k) : S.dark(c, 0.34);
  if (S.hour === "night") return k > 0.5 ? c : S.dark(c, 0.3);
  return k > 0.5 ? S.lit(c, 0.14 * k) : S.dark(c, 0.3);
}

// One window. A part of the windows has light at dusk and at night.
function pane(S, x, y, w, h, wall, u) {
  const { cv, P, hour } = S;
  const on = hour !== "day" && u < (hour === "night" ? 0.46 : 0.26);
  cv.oilPastel([[x, y], [x, y + h]], on ? (u < 0.08 ? S.lit(P.lamp, 0.5) : P.lamp) : S.dark(wall, 0.55), w, { cap: 0.3 });
}

// A house with a tile roof. z is 0 for far and 1 for near. Far houses take the color of the air.
function building(S, { x, y, w, h, z }) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const far = (1 - z) ** 1.4 * 0.56;
  const air = S.skyAt(x, yh - 14);
  const hz = (c) => mix(c, air, far);
  const u0 = R();
  const wall = u0 < 0.16 ? ramp(C.terra, R.range(0.45, 1)) : u0 < 0.3 ? ramp(C.trav, R.range(0.5, 1)) : ramp(C.ochre, R.range(0.2, 1));
  const lightLeft = S.light[0] < x;
  const xc = x + w * R.range(-0.28, 0.28);
  const [x0, x1] = [x - w / 2, x + w / 2];
  const cl = hz(face(S, wall, lightLeft ? 1 : 0));
  const cr = hz(face(S, wall, lightLeft ? 0 : 1));
  if (w < 26) {
    cv.oilPastel(cv.line(x0, y - h / 2, xc, y - h / 2, 0.3), cl, h, { cap: 0.2 });
    cv.oilPastel(cv.line(xc, y - h / 2, x1, y - h / 2, 0.3), cr, h, { cap: 0.2 });
  } else {
    const sw = Math.max(6, w * 0.19);
    cv.hatch(rect(x0, y - h, xc, y), "oilPastel", cl, { angle: 1.56, width: sw, spacing: sw * 0.6, maxLen: h * 1.6, over: [-1, 2], cj: 0.03 });
    cv.hatch(rect(xc, y - h, x1, y), "oilPastel", cr, { angle: 1.56, width: sw, spacing: sw * 0.6, maxLen: h * 1.6, over: [-1, 2], cj: 0.03 });
    cv.pencil(cv.line(xc, y - h, xc + R.range(-1, 1), y, 0.4), hz(S.dark(wall, 0.45)), 1.6, { press: 0.75 });
  }
  // Roof: a band of tiles. The viewer is above the roofs.
  const rw = Math.max(2.2, w * R.range(0.2, 0.36));
  const flat = R() < 0.14;
  const tile = flat ? ramp(C.trav, R.range(0.35, 0.8)) : ramp(C.terra, R.range(0.25, 0.95));
  const roof = hz(hour === "dusk" ? mix(tile, P.sun, 0.12) : tile);
  const tilt = R.range(-0.04, 0.04) * w;
  const ry = y - h - rw * 0.42;
  cv.oilPastel(cv.line(x0 - 1.5, ry - tilt, x1 + 1.5, ry + tilt, 0.5), roof, rw);
  if (w > 13) cv.pencil(cv.line(x0 - 1, y - h + 0.6, x1 + 1, y - h + 0.6, 0.4), hz(S.dark(wall, 0.6)), Math.max(1.2, w * 0.035), { press: 0.8 });
  if (w > 20 && !flat) {
    // Ridge with light, and the lines of the tiles.
    cv.pencil(cv.line(x0, ry - rw * 0.45 - tilt, x1, ry - rw * 0.45 + tilt, 0.5), hz(hour === "day" ? S.lit(tile, 0.4) : hour === "dusk" ? P.sun : S.lit(tile, 0.25)), Math.max(1.3, w * 0.03), { press: 0.85 });
    const n = w > 40 ? Math.floor(w / 9) : 0;
    for (let i = 0; i < n; i++) {
      const tx = x0 + ((i + R()) / n) * w;
      cv.pencil([[tx, ry - rw * 0.4], [tx + rw * 0.2, ry + rw * 0.42]], hz(S.dark(tile, 0.28)), 1.2, { press: 0.7 });
    }
  }
  // Windows.
  if (w > 22) {
    const rows = Math.max(1, Math.min(4, Math.floor(h / (13 + 9 * z))));
    const cols = Math.max(2, Math.min(6, Math.floor(w / (9 + 6 * z))));
    const [ww, wh] = [Math.max(1.4, w * 0.036), Math.max(2.4, (h / rows) * 0.34)];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = R();
        const wx = x0 + ((c + 0.5) / cols) * w;
        if (Math.abs(wx - xc) < ww * 1.5 || u > 0.72) continue;
        pane(S, wx, y - h + ((r + 0.3) / rows) * h, ww, wh, hz(wall), u);
      }
    }
  } else if (w > 9) {
    // A far house has one window. It is a point of light at night.
    const u = R();
    if (u < 0.5) pane(S, x + (u - 0.25) * w, y - h * 0.62, Math.max(1.2, w * 0.07), Math.max(1.8, h * 0.22), hz(wall), u * 1.3);
  }
  // Things on the roof: a chimney, an aerial or a small garden.
  const top = R();
  if (w > 18 && top < 0.3) {
    const cx = x + R.range(-0.3, 0.3) * w;
    cv.oilPastel([[cx, ry - rw * 0.3], [cx, ry - rw * 0.3 - w * 0.16]], hz(S.dark(tile, 0.25)), Math.max(2, w * 0.07), { cap: 0.2 });
  } else if (w > 24 && top < 0.5) {
    const ax = x + R.range(-0.3, 0.3) * w;
    cv.pencil(cv.line(ax, ry, ax + R.range(-2, 2), ry - w * 0.5, 0.3), hz(P.ink), 1.1, { press: 0.75 });
    cv.pencil(cv.line(ax - w * 0.08, ry - w * 0.42, ax + w * 0.08, ry - w * 0.44, 0.2), hz(P.ink), 1, { press: 0.7 });
  } else if (w > 30 && top < 0.66) {
    for (let i = 0; i < 6; i++) cv.dot(x + R.range(-0.35, 0.35) * w, ry - rw * 0.5 - R.range(0, 5), R.range(2.4, 4.6), hz(ramp(C.pine, R.range(0.3, 0.9))), { grain: 0.4 });
  }
  S.cut();
}

// A dome on a drum, with ribs and a lantern. y is the foot of the drum.
function dome(S, { x, y, r, z = 0.3, drum = 0.75, tall = 1.08, tile = false }) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const far = (1 - z) ** 1.4 * 0.5;
  const air = S.skyAt(x, yh - 14);
  const hz = (c) => mix(c, air, far);
  const lightLeft = S.light[0] < x;
  const side = lightLeft ? -1 : 1;
  const stone = ramp(C.trav, 0.78);
  const lead = tile ? ramp(C.terra, 0.55) : ramp(C.trav, 0.3);
  const dh = r * drum;
  const [dx0, dx1] = [x - r * 0.86, x + r * 0.86];
  const sw = Math.max(2, r * 0.13);
  // Drum: a light face and a dark face, with pilasters and windows.
  const mid = x + side * r * 0.25;
  const glow = hour === "night" ? 0.4 : 0;
  const lit = hz(mix(face(S, stone, 1), P.lamp, glow));
  const shade = hz(mix(face(S, stone, 0), P.lamp, glow * 0.5));
  cv.hatch(rect(dx0, y - dh, mid, y), "oilPastel", lightLeft ? lit : shade, { angle: 1.56, width: sw, spacing: sw * 0.55, maxLen: dh, over: [-1, 1.5], cj: 0.02 });
  cv.hatch(rect(mid, y - dh, dx1, y), "oilPastel", lightLeft ? shade : lit, { angle: 1.56, width: sw, spacing: sw * 0.55, maxLen: dh, over: [-1, 1.5], cj: 0.02 });
  const n = Math.max(3, Math.round(r / 7));
  for (let i = 0; i <= n; i++) {
    const px = x + Math.sin(((i / n) * 2 - 1) * 1.25) * r * 0.9;
    cv.pencil(cv.line(px, y - dh, px, y, 0.3), hz(S.dark(stone, 0.4)), Math.max(1.1, r * 0.03), { press: 0.75 });
    if (i < n && r > 15) {
      const wx = x + Math.sin((((i + 0.5) / n) * 2 - 1) * 1.25) * r * 0.9;
      pane(S, wx, y - dh * 0.72, Math.max(1.4, r * 0.06), dh * 0.36, hz(stone), R());
    }
  }
  cv.oilPastel(cv.line(dx0 - r * 0.06, y - dh, dx1 + r * 0.06, y - dh, 0.3), hz(S.lit(stone, 0.25)), Math.max(1.6, r * 0.07));
  // Shell: the tone changes from the light side to the dark side.
  const [rx, ryy] = [r * 0.84, r * tall];
  const by = y - dh - r * 0.03;
  const shell = [];
  for (let i = 0; i <= 26; i++) {
    const a = Math.PI - (i / 26) * Math.PI;
    shell.push([x + Math.cos(a) * rx, by - Math.sin(a) ** 0.9 * ryy]);
  }
  const tone = (px, py) => {
    const k = clamp(0.5 - (side * (px - x)) / (rx * 1.5) + 0.25 * ((by - py) / ryy - 0.4) + (vnoise(px / 9, py / 9, 5) - 0.5) * 0.2);
    const c = hour === "night" ? mix(S.dark(lead, 0.2), ramp(C.trav, 0.9), 0.5 * k + 0.28 * sm(by - ryy * 0.5, by, py)) : mix(S.dark(lead, 0.3), hour === "dusk" ? mix(lead, P.sun, 0.5) : S.lit(lead, 0.5), k);
    return hz(c);
  };
  cv.hatch(shell, "oilPastel", tone, { angle: 1.3 * -side, width: sw, spacing: sw * 0.5, maxLen: r * 0.7, over: [-1, 1], cj: 0.02 });
  // Ribs: lines from the drum to the top.
  const ribs = Math.max(3, Math.round(r / 6));
  for (let i = 0; i <= ribs; i++) {
    const phi = ((i / ribs) * 2 - 1) * 1.35;
    const pts = [];
    for (let t = 0; t <= 1.001; t += 0.125) pts.push([x + Math.sin(phi) * Math.cos((t * Math.PI) / 2) * rx, by - Math.sin((t * Math.PI) / 2) ** 0.9 * ryy]);
    cv.pencil(pts, hz(side * Math.sin(phi) < -0.2 ? S.lit(lead, 0.55) : S.dark(lead, 0.42)), Math.max(1.1, r * 0.032), { press: 0.8 });
  }
  // Lantern, ball and cross.
  const ly = by - ryy;
  const lw = r * 0.2;
  cv.oilPastel([[x, ly + r * 0.04], [x, ly - r * 0.3]], hz(lit), lw, { cap: 0.2 });
  cv.pencil([[x + side * lw * 0.3, ly], [x + side * lw * 0.3, ly - r * 0.28]], hz(S.dark(stone, 0.5)), Math.max(1.1, lw * 0.3));
  cv.oilPastel([[x - lw * 0.6, ly - r * 0.3], [x, ly - r * 0.46], [x + lw * 0.6, ly - r * 0.3]], hz(S.dark(lead, 0.15)), Math.max(1.4, lw * 0.5));
  cv.dot(x, ly - r * 0.5, Math.max(1.2, r * 0.045), hz(hour === "day" ? P.lamp : P.sun), { grain: 0.2 });
  if (r > 20) {
    cv.pencil([[x, ly - r * 0.5], [x, ly - r * 0.7]], hz(P.ink), 1.2);
    cv.pencil([[x - r * 0.05, ly - r * 0.63], [x + r * 0.05, ly - r * 0.63]], hz(P.ink), 1.1);
  }
  if (hour === "night") {
    // Lamps below give the dome a warm light.
    for (let i = 0; i < 3 + r * 0.12; i++) {
      const ly = y - dh * R.range(0, 0.9);
      cv.softPastel(cv.line(x - R.range(0.3, 0.9) * r, ly, x + R.range(0.3, 0.9) * r, ly + R.range(-2, 2), 0.5), P.lamp, Math.max(1.6, r * 0.07), { press: 0.36 });
    }
  }
  S.cut();
}

// Bell tower with open arches and a low tile roof.
function tower(S, { x, y, w, h, z = 0.4, spire = false }) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const far = (1 - z) ** 1.4 * 0.5;
  const air = S.skyAt(x, yh - 14);
  const hz = (c) => mix(c, air, far);
  const lightLeft = S.light[0] < x;
  const wall = ramp(C.ochre, R.range(0.3, 0.75));
  const sw = Math.max(2, w * 0.24);
  const xc = x + (lightLeft ? 0.12 : -0.12) * w;
  cv.hatch(rect(x - w / 2, y - h, xc, y), "oilPastel", hz(face(S, wall, lightLeft ? 1 : 0)), { angle: 1.56, width: sw, spacing: sw * 0.55, maxLen: h * 0.5, over: [-1, 1.5], cj: 0.02 });
  cv.hatch(rect(xc, y - h, x + w / 2, y), "oilPastel", hz(face(S, wall, lightLeft ? 0 : 1)), { angle: 1.56, width: sw, spacing: sw * 0.55, maxLen: h * 0.5, over: [-1, 1.5], cj: 0.02 });
  const tiers = Math.max(2, Math.round(h / (w * 1.15)));
  for (let i = 1; i <= tiers; i++) {
    const ty = y - (h * i) / tiers;
    cv.pencil(cv.line(x - w * 0.56, ty, x + w * 0.56, ty, 0.2), hz(S.lit(wall, 0.4)), Math.max(1.2, w * 0.07));
    if (i < tiers - 1 && i > 0) continue;
    // Arches of the bell room.
    for (const k of [-0.22, 0.22]) pane(S, x + k * w, ty + (h / tiers) * 0.25, Math.max(1.5, w * 0.16), (h / tiers) * 0.5, hz(wall), R() * 0.6 + 0.3);
  }
  const roof = hz(ramp(C.terra, 0.6));
  if (spire) {
    cv.hatch([[x - w * 0.5, y - h], [x + w * 0.5, y - h], [x, y - h - w * 2.2]], "oilPastel", hz(face(S, ramp(C.trav, 0.6), lightLeft ? 1 : 0)), { angle: 1.5, width: sw, spacing: sw * 0.5, maxLen: w * 2, over: [-0.5, 0.5] });
    cv.pencil([[x, y - h], [x, y - h - w * 2.2]], hz(S.dark(wall, 0.4)), 1.2);
  } else {
    cv.oilPastel([[x - w * 0.62, y - h], [x, y - h - w * 0.5], [x + w * 0.62, y - h]], roof, Math.max(2, w * 0.22));
    cv.pencil([[x, y - h - w * 0.5], [x, y - h - w * 0.95]], hz(P.ink), 1.2);
  }
  if (hour !== "day") cv.softPastel(cv.line(x - w * 0.5, y - h * 0.9, x + w * 0.5, y - h * 0.9, 0.3), P.lamp, Math.max(1.6, w * 0.18), { press: 0.45 });
  S.cut();
}

// St Peter's: the large dome, two small domes and the long front.
function stPeters(S, x, y, r) {
  const { cv, R } = S;
  const C = S.C;
  const air = S.skyAt(x, yh - 14);
  const hz = (c) => mix(c, air, 0.36);
  const lightLeft = S.light[0] < x;
  const stone = ramp(C.trav, 0.7);
  // Front: a long block with columns.
  const [fw, fh] = [r * 3.3, r * 0.72];
  const sw = Math.max(2, r * 0.1);
  cv.hatch(rect(x - fw / 2, y - fh, x + fw / 2, y), "oilPastel", (px) => hz(face(S, stone, lightLeft === px < x ? 1 : 0.4)), { angle: 1.56, width: sw, spacing: sw * 0.55, maxLen: fh, over: [-1, 1], cj: 0.02 });
  for (let px = x - fw / 2 + 3; px < x + fw / 2; px += r * 0.16) cv.pencil(cv.line(px, y - fh * 0.9, px, y - 1, 0.2), hz(S.dark(stone, 0.42)), 1.2, { press: 0.75 });
  cv.oilPastel(cv.line(x - fw / 2 - 2, y - fh, x + fw / 2 + 2, y - fh, 0.3), hz(S.lit(stone, 0.3)), Math.max(1.6, r * 0.06));
  for (let i = 0; i < 9; i++) cv.dot(x - fw / 2 + ((i + 0.5) / 9) * fw, y - fh - 2.4, 1.3, hz(S.dark(stone, 0.2)), { grain: 0.3 });
  R();
  dome(S, { x: x - r * 1.05, y: y - fh, r: r * 0.26, z: 0.25, drum: 0.6 });
  dome(S, { x: x + r * 1.05, y: y - fh, r: r * 0.26, z: 0.25, drum: 0.6 });
  dome(S, { x, y: y - fh, r, z: 0.25, drum: 0.62, tall: 1.16 });
}

// Umbrella pine: a bare trunk, limbs that go up like a fan, and a flat crown of round parts.
function stonePine(S, { bx, by, cx, cy, w, h, seed = 1, back = 0 }) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const lightLeft = S.light[0] < cx;
  const side = lightLeft ? -1 : 1;
  const fork = [cx + (bx - cx) * 0.12, cy + h * 0.95];
  const trunk = spline([[bx, by], [bx + (fork[0] - bx) * 0.3, by + (fork[1] - by) * 0.45], [fork[0] - (fork[0] - bx) * 0.12, by + (fork[1] - by) * 0.8], fork], 12);
  const tw = w * 0.05;
  for (const k of [-1, 0, 1]) {
    const l = 0.2 + 0.32 * (k * side < 0 ? 0 : k === 0 ? 0.5 : 1) - back * 0.12;
    cv.charcoal(cv.wobble(trunk.map(([x, y]) => [x + k * tw * 0.36, y]), 1.2), ramp(C.bark, hour === "dusk" && k * side > 0 ? l + 0.3 : l), tw * 0.55, { press: 1.25 });
  }
  for (let i = 2; i < trunk.length - 1; i += 2) {
    // Plates of the bark.
    const [x, y] = trunk[i];
    cv.pencil(cv.line(x - tw * 0.5, y + R.range(-4, 4), x + tw * 0.5, y + R.range(-4, 4), 0.6), C.bark[0], 1.7, { press: 0.8 });
    cv.pencil([[x + side * tw * 0.3, y - 7], [x + side * tw * 0.34, y + 7]], ramp(C.bark, 0.9), 1.6, { press: 0.75 });
  }
  // Crown: round parts along a low arc. The lower edge is almost level.
  const lobes = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * 2 - 1;
    lobes.push({ x: cx + f * w * 0.4 + R.range(-0.03, 0.03) * w, y: cy + h * (0.3 * f * f + R.range(-0.06, 0.06)), rx: w * R.range(0.13, 0.19), ry: h * R.range(0.34, 0.5) });
  }
  for (let i = 0; i < 4; i++) lobes.push({ x: cx + R.range(-0.26, 0.26) * w, y: cy - h * R.range(0.12, 0.3), rx: w * R.range(0.12, 0.17), ry: h * R.range(0.3, 0.42) });
  // Limbs from the fork to the parts of the crown.
  for (const f of [-0.82, -0.5, -0.2, 0.15, 0.48, 0.8]) {
    const tip = [cx + f * w * 0.4, cy + h * (0.36 + 0.2 * f * f)];
    const limb = spline([fork, [fork[0] + (tip[0] - fork[0]) * 0.55, fork[1] + (tip[1] - fork[1]) * 0.42], tip], 8);
    cv.charcoal(cv.wobble(limb, 1), ramp(C.bark, 0.14 + (f * side > 0 ? 0.3 : 0)), tw * (0.42 - 0.12 * Math.abs(f)), { press: 1.2, taper: 0.4 });
  }
  const field = (x, y) => {
    let best = -9;
    let ny = 0;
    for (const b of lobes) {
      const dx = (x - b.x) / b.rx;
      const dy = (y - b.y) / b.ry;
      const q = 1 - Math.sqrt(dx * dx + dy * dy);
      if (q > best) {
        best = q;
        ny = dy;
      }
    }
    // Gaps where the sky shows.
    return [best + (fbm(x / 26, y / 20, seed * 13, 2) - 0.5) * 0.5, ny];
  };
  const body = (x, y) => sm(-0.04, 0.16, field(x, y)[0]);
  const tone = (x, y) => {
    const [d, ny] = field(x, y);
    const l = 0.3 - 0.3 * ny + 0.16 * side * ((x - cx) / (w * 0.5)) * -1 + (fbm(x / 30, y / 18, seed * 7, 2) - 0.5) * 0.5 - 0.12 * sm(0.3, 0, d) - back * 0.16 + R.gauss() * 0.05;
    return ramp(C.pine, l);
  };
  const box = [cx - w * 0.62, cy - h * 0.85, cx + w * 0.62, cy + h * 0.85];
  cv.scumble(box, "block", { angle: 0.1, jitter: 0.5, len: [16, 34], width: [9, 14], gap: 0.5, lap: 0.6, mask: body, color: tone, cj: 0.02 });
  // Needles: short dabs. Dark below, light on the top of each round part.
  cv.scumble(box, "softPastel", { angle: (x, y) => vnoise(x / 22, y / 22, seed) * 3.1, jitter: 0.5, len: [8, 18], width: [3.4, 6], gap: 1.35, lap: 0.8, mask: body, color: tone, cj: 0.04 });
  cv.scumble(box, "pencil", { angle: 0.9, len: [8, 20], width: [1.8, 2.8], gap: 2.6, mask: (x, y) => body(x, y) * sm(-0.1, 0.5, field(x, y)[1]), color: (x, y) => S.dark(tone(x, y), 0.4), cj: 0.03 });
  cv.scumble(box, "oilPastel", { angle: -0.2, jitter: 0.6, len: [5, 12], width: [2.6, 4.4], gap: 2.6, lap: 0.8, mask: (x, y) => body(x, y) * sm(-0.2, -0.75, field(x, y)[1]) * (back ? 0.4 : 1), color: () => (hour === "dusk" ? mix(C.pine[4], P.sun, 0.35) : hour === "night" ? mix(C.pine[4], P.cloud[4], 0.3) : mix(C.pine[3], C.pine[4], 0.5)), cj: 0.04 });
  S.cut();
}

// Cypress: a tall dark spindle.
function cypress(S, x, by, h, w, seed = 1) {
  const { cv, R } = S;
  const C = S.C;
  const side = S.light[0] < x ? -1 : 1;
  const half = (y) => {
    const t = clamp((by - y) / h);
    return (w / 2) * Math.sin(Math.PI * t ** 0.62) ** 0.7 * (0.82 + 0.3 * vnoise(y / 16, seed, 4));
  };
  const lean = (y) => (vnoise(y / 90, seed * 3, 2) - 0.5) * w * 0.3;
  const body = (px, y) => (y < by && y > by - h && Math.abs(px - x - lean(y)) < half(y) ? 1 : 0);
  const tone = (px, y) => ramp(C.pine, 0.2 + 0.34 * clamp((side * (px - x - lean(y))) / (half(y) + 1) * -1, -1, 1) + (fbm(px / 9, y / 22, seed * 5, 2) - 0.5) * 0.45 + R.gauss() * 0.05);
  const box = [x - w, by - h - 6, x + w, by + 2];
  cv.scumble(box, "block", { angle: 1.5, jitter: 0.12, len: [14, 30], width: [6, 10], gap: 0.5, lap: 0.6, mask: body, color: tone, cj: 0.02 });
  cv.scumble(box, "softPastel", { angle: (px) => 1.57 + (px - x) * 0.012, jitter: 0.3, len: [8, 20], width: [2.6, 4.6], gap: 1.2, lap: 0.8, mask: body, color: tone, cj: 0.04 });
  cv.pencil(cv.line(x + lean(by - h), by - h - 2, x + lean(by - h) + side * -2, by - h - 16, 0.4), C.pine[1], 1.8, { taper: 0.8 });
  S.cut();
}

// Trees between the roofs: round dabs, with a small pine or a small cypress.
function grove(S, { x, y, s, z }) {
  const { cv, R } = S;
  const C = S.C;
  const air = S.skyAt(x, yh - 14);
  const far = (1 - z) ** 1.4 * 0.5;
  const kind = R();
  const n = 5 + Math.floor(R() * 6);
  for (let i = 0; i < n; i++) {
    const dx = R.gauss() * s * 0.6;
    const dy = -R() * s * 0.5;
    cv.dot(x + dx, y + dy, s * R.range(0.14, 0.26), mix(ramp(C.pine, 0.2 + 0.6 * R() - dy / s * -0.3), air, far), { grain: 0.45 });
  }
  if (kind < 0.35) {
    // Small umbrella pine.
    const hgt = s * R.range(1.0, 1.5);
    cv.pencil(cv.line(x, y, x + R.range(-2, 2), y - hgt, 0.5), mix(C.bark[1], air, far), Math.max(1.3, s * 0.07));
    for (let i = 0; i < 7; i++) cv.dot(x + R.range(-0.5, 0.5) * s, y - hgt + R.range(-0.08, 0.06) * s, s * R.range(0.12, 0.2), mix(ramp(C.pine, R.range(0.15, 0.7)), air, far), { grain: 0.45 });
  } else if (kind < 0.6) {
    const hgt = s * R.range(1.1, 1.8);
    cv.charcoal([[x + s * 0.4, y], [x + s * 0.4, y - hgt]], mix(C.pine[1], air, far), Math.max(1.8, s * 0.16), { taper: 0.85, press: 1.2 });
  }
  S.cut();
}

// Brick of the castle. k is 1 on the side of the light. low is 1 at the foot of a wall.
// At night, lamps on the ground light the walls from below.
function brick(S, x, y, k, low = 0.5) {
  const C = S.C;
  const n = (fbm(x / 30, y / 10, 41, 2) - 0.5) * 0.24;
  if (S.hour === "night") return ramp(C.castle, 0.26 + 0.2 * k + 0.46 * low + n);
  const c = ramp(C.castle, 0.1 + 0.78 * k + n);
  return S.hour === "dusk" && k > 0.6 ? mix(c, S.P.sun, 0.16) : c;
}

// Pale stone of the bridge and the river wall. k is 1 for a face in the light. lamp adds warm light at night.
function stone(S, x, y, k, lamp = 0) {
  const { P, hour } = S;
  const c = ramp(S.C.trav, 0.5 + 0.34 * k + (fbm(x / 40, y / 8, 61, 2) - 0.5) * 0.3);
  if (hour === "night") return mix(S.dark(c, 0.3 * (1 - k)), mix(P.hot, P.lamp, 0.55), lamp);
  if (hour === "dusk") return k > 0.5 ? mix(c, P.sun, 0.22 * k) : S.dark(c, 0.26);
  return k > 0.5 ? S.lit(c, 0.14 * k) : S.dark(c, 0.2);
}

// A round tower seen from above: a wall between two curved edges, a flat top, and a band of corbels below the parapet.
// yt is the center of the top. yb is the foot at the two edges. e is the half height of the top ellipse.
function roundTower(S, { x, r, yt, yb, e, base = 0.3, panes = 0 }) {
  const { cv, R } = S;
  const C = S.C;
  const side = S.light[0] < x ? -1 : 1;
  const rim = (u) => e * Math.sqrt(Math.max(0, 1 - u * u));
  const arc = (dy, k = 1) => {
    const n = Math.max(8, Math.round(r / 5));
    return Array.from({ length: n + 1 }, (_, i) => [x + ((i / n) * 2 - 1) * r * k, yt + dy + rim((i / n) * 2 - 1)]);
  };
  const kx = (px) => 0.5 + 0.5 * Math.sin(clamp(((px - x) / r) * side * 1.25 + 0.3, -1.57, 1.57));
  const H = yb - yt;
  const tone = (px, py) => {
    const low = clamp((py - yt) / H);
    const c = brick(S, px, py, kx(px), low);
    // The old Roman base has more gray.
    return low > 1 - base && S.hour !== "night" ? mix(c, S.dark(ramp(C.trav, 0.5), 0.1), 0.2) : c;
  };
  const sw = clamp(r * 0.05, 3, 7.5);
  // Top: the floor of the terrace.
  const fw = Math.max(2.4, e * 0.34);
  cv.hatch(ellipse(x, yt, r, e, 0, 24), "oilPastel", (px, py) => brick(S, px, py, 0.86, 0.16), { angle: 0, width: fw, spacing: fw * 0.6, maxLen: r, over: [-1, 1], cj: 0.02 });
  cv.hatch([...arc(0), ...arc(H).reverse()], "oilPastel", tone, { angle: 1.56, width: sw, spacing: sw * 0.55, maxLen: Math.max(26, H * 0.7), over: [-1, 1.5], cj: 0.025, skip: 0 });
  // Parapet, a pale band, and the corbels: short dark marks.
  const pd = clamp(r * 0.06, 3.4, 9);
  cv.oilPastel(arc(0.5), brick(S, x - side * r * 0.4, yt, 1, 0.5), Math.max(1.6, r * 0.018), { press: 0.95 });
  const step = clamp(r * 0.045, 3.2, 6.5);
  for (let px = x - r * 0.97; px < x + r * 0.97; px += step) {
    const u = (px - x) / r;
    cv.pencil([[px, yt + pd + 1.5 + rim(u)], [px, yt + pd * 2.1 + rim(u)]], S.dark(tone(px, yt + pd), 0.55), Math.max(1.3, r * 0.015), { press: 0.9 });
  }
  cv.oilPastel(arc(pd), mix(tone(x - side * r * 0.5, yt + pd), stone(S, x, yt, 1, S.hour === "night" ? 0.6 : 0), 0.5), Math.max(1.6, r * 0.018), { press: 0.95 });
  cv.pencil(arc(pd * 2.25), S.dark(tone(x, yt + pd * 2), 0.34), Math.max(1.2, r * 0.012), { press: 0.8 });
  // The line between the brick and the old base.
  cv.pencil(arc(H * (1 - base), 0.995), S.lit(tone(x - side * r * 0.5, yb), 0.24), Math.max(1.2, r * 0.012), { press: 0.8 });
  for (let i = 0; i < panes; i++) {
    const u = (((i + 0.5) / panes) * 2 - 1) * 0.86;
    pane(S, x + u * r, yt + pd * 2.7 + rim(u), Math.max(1.6, r * 0.017), Math.max(3.4, r * 0.045), tone(x + u * r, yt + pd * 3), R() * 0.7);
  }
  // Rows of brick and marks of the weather.
  const inside = (px, py) => {
    const u = (px - x) / r;
    return Math.abs(u) < 0.98 && py > yt + pd * 2.4 + rim(u) && py < yb + rim(u) - 2 ? 1 : 0;
  };
  cv.scumble([x - r, yt, x + r, yb + e], "pencil", { angle: 0.02, jitter: 0.06, len: [7, 20], width: [1.2, 1.9], gap: 7, mask: inside, color: (px, py) => (R() < 0.6 ? S.dark(tone(px, py), 0.24) : S.lit(tone(px, py), 0.2)), cj: 0.03, press: 0.75 });
  if (r > 60) cv.scumble([x - r, yt, x + r, yb + e], "pencil", { angle: 1.57, jitter: 0.05, len: [14, 44], width: [1.3, 2.2], gap: 16, mask: inside, color: (px, py) => S.dark(tone(px, py), 0.2), cj: 0.03, press: 0.7 });
  S.cut();
}

// The Castel Sant'Angelo: the square wall with round bastions, the brick drum, the upper block and the bronze angel.
function castle(S) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const night = hour === "night";
  const side = S.light[0] < CX ? -1 : 1;
  const foot = yFar(CX) - wallH(CX) - 5;
  const wallTop = foot - 54;
  const [wx0, wx1] = [CX - 214, CX + 214];
  const yt = wallTop - 86;
  cv.layer = 5;
  const block = (x0, y0, x1, y1, color, sw = 5) => cv.hatch(rect(x0, y0, x1, y1), "oilPastel", color, { angle: 1.56, width: sw, spacing: sw * 0.55, maxLen: Math.max(24, (y1 - y0) * 0.8), over: [-1, 1], cj: 0.025 });

  // The court behind the front wall: the far wall, and trees.
  cv.hatch([[wx0 + 30, wallTop - 28], [wx1 - 30, wallTop - 28], [wx1, wallTop + 2], [wx0, wallTop + 2]], "oilPastel", (x, y) => S.dark(brick(S, x, y, 0.42, 0.1), 0.12), { angle: 0, width: 6, spacing: 3.4, maxLen: 90, over: [-1, 1], cj: 0.03 });
  cv.pencil(cv.line(wx0 + 30, wallTop - 28, wx1 - 30, wallTop - 28, 0.5), brick(S, CX, wallTop, 0.9, 0.2), 2, { press: 0.85 });
  for (let i = 0; i < 30; i++) {
    const k = i % 2 ? 1 : -1;
    cv.dot(CX + k * R.range(158, 204), wallTop - R.range(3, 24), R.range(4, 7.5), ramp(C.pine, R.range(0.15, 0.75)), { grain: 0.45 });
  }
  S.cut();

  roundTower(S, { x: CX, r: DR, yt, yb: wallTop + 12, e: 13, base: 0.3, panes: 7 });

  // The upper block: the pale rooms of the popes with a loggia, and a taller brick part behind.
  const top = yt + 3;
  const lowOf = (y) => clamp((y - (yt - 78)) / 82);
  const pale = (x, y, k) => (night ? mix(brick(S, x, y, k, lowOf(y)), P.lamp, 0.14) : mix(brick(S, x, y, k), face(S, ramp(C.ochre, 0.72), k > 0.5 ? 1 : 0), 0.62));
  const lit = side < 0 ? 0.82 : 0.4;
  const dim = side < 0 ? 0.3 : 0.74;
  // Tall part.
  const [bx0, bx1, by] = [CX - 6, CX + 84, yt - 76];
  const cut = bx1 - 26;
  block(bx0, by, cut, top, (x, y) => brick(S, x, y, lit, lowOf(y)));
  block(cut, by, bx1, top, (x, y) => brick(S, x, y, dim, lowOf(y)));
  for (let x = bx0 + 2; x < bx1; x += 7.4) cv.oilPastel([[x, by - 4.5], [x, by + 1]], brick(S, x, by, x < cut ? 0.95 : 0.5, 0.2), 3.6, { cap: 0.2 });
  cv.pencil(cv.line(bx0, by + 6, bx1, by + 6, 0.3), S.dark(brick(S, CX, by, 0.3, 0.2), 0.3), 1.4, { press: 0.8 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) pane(S, bx0 + 10 + c * 18 + (c > 2 ? 6 : 0), by + 14 + r * 19, 2.6, 6.4, brick(S, CX, by, 0.5, 0.4), R() * 0.8);
  // Pale part, with a tile roof.
  const [ax0, ax1, ay] = [CX - 100, CX + 30, yt - 52];
  const acut = ax1 - 20;
  block(ax0, ay, acut, top, (x, y) => pale(x, y, lit));
  block(acut, ay, ax1, top, (x, y) => pale(x, y, dim));
  const roof = night ? ramp(C.castle, 0.16) : hour === "dusk" ? mix(ramp(C.terra, 0.5), P.sun, 0.12) : ramp(C.terra, 0.55);
  cv.oilPastel(cv.line(ax0 - 3, ay - 1, ax1 + 3, ay - 1, 0.4), roof, 5.4);
  cv.pencil(cv.line(ax0 - 3, ay - 4, ax1 + 3, ay - 4, 0.3), S.lit(roof, 0.3), 1.4, { press: 0.8 });
  // Loggia: a dark opening with columns. It has light at dusk and at night.
  const [lx0, lx1, ly] = [ax0 + 38, ax0 + 84, ay + 17];
  cv.hatch(rect(lx0, ly, lx1, ly + 14), "oilPastel", hour === "day" ? S.dark(ramp(C.castle, 0.1), 0.35) : P.lamp, { angle: 0, width: 4, spacing: 2.4, maxLen: 50, over: [-0.5, 0.5] });
  for (let x = lx0; x <= lx1 + 1; x += 11.5) cv.pencil([[x, ly - 1], [x, ly + 15]], pale(x, ly, 1), 2.2, { press: 0.9 });
  cv.pencil(cv.line(lx0 - 2, ly + 15, lx1 + 2, ly + 15, 0.2), pale(CX, ly, 1), 1.8);
  for (const [dx, dy] of [[12, 10], [26, 10], [96, 10], [112, 10], [12, 32], [26, 32], [44, 34], [62, 34], [80, 34], [98, 32], [114, 32]]) pane(S, ax0 + dx, ay + dy, 2.6, 6.6, pale(CX, ay, 0.5), R() * 0.8);
  // Low part at the left.
  block(ax0 - 26, ay + 22, ax0, top, (x, y) => brick(S, x, y, lit * 0.9, lowOf(y)), 4.4);
  cv.oilPastel(cv.line(ax0 - 28, ay + 21, ax0 + 1, ay + 21, 0.3), roof, 4);
  S.cut();
  // The bronze angel on its base, and the flag pole.
  const ax = CX + 26;
  const bronze = night ? mix(P.ink, P.lamp, 0.42) : hour === "dusk" ? S.dark(hex("#3a2c5a"), 0.3) : hex("#27424c");
  cv.oilPastel([[ax, by - 1], [ax, by - 11]], stone(S, ax, by, 0.8, night ? 0.5 : 0), 8, { cap: 0.2 });
  cv.oilPastel([[ax, by - 10], [ax + 0.4, by - 27]], bronze, 4.4, { cap: 0.3 });
  cv.pencil([[ax - 1.5, by - 22], [ax - 8, by - 28], [ax - 6.5, by - 35]], bronze, 2.4, { press: 1 });
  cv.pencil([[ax + 1.5, by - 22], [ax + 8, by - 27], [ax + 7.5, by - 34]], bronze, 2.4, { press: 1 });
  cv.pencil([[ax + 1, by - 21], [ax + 7, by - 15]], bronze, 1.5, { press: 0.9 });
  cv.dot(ax + 0.3, by - 29.5, 2.5, bronze, { grain: 0.2 });
  const px = CX + 62;
  cv.pencil(cv.line(px, by - 2, px, by - 66, 0.3), night ? S.lit(P.ink, 0.3) : P.ink, 1.5, { press: 0.9 });
  S.cut();
  // The flag moves in the wind.
  const bands = hour === "night" ? [hex("#3f8a6a"), P.cloud[6], hex("#d8604a")] : [hex("#3f9a62"), P.sun, P.hot];
  S.sprites.push({
    seed: 63,
    keep: 5,
    draw(ov, t) {
      const wave = (x) => Math.sin(t * 3.4 - x * 0.36) * x * 0.13 + x * 0.06;
      for (let i = 0; i < 3; i++) ov.oilPastel([[px + 1.5 + i * 6.2, by - 58 + wave(i * 6.2)], [px + 8 + i * 6.2, by - 58 + wave(6.2 + i * 6.2)]], bands[i], 10.5, { cap: 0.2, press: 1.1 });
    },
  });

  // Front wall with battlements, between two round bastions.
  const wcol = (x, y) => brick(S, x, y, 0.56 + 0.3 * (fbm(x / 80, 2.2, 13, 2) - 0.5) + (side < 0 ? 0.08 : 0), clamp((y - wallTop) / (foot - wallTop)));
  cv.hatch(rect(wx0, wallTop, wx1, foot + 3), "oilPastel", wcol, { angle: 1.56, width: 7, spacing: 3.8, maxLen: 44, over: [-1, 1], cj: 0.025, skip: 0 });
  for (let x = wx0 + 3; x < wx1; x += 8.6) cv.oilPastel([[x, wallTop - 4.5], [x, wallTop + 1]], brick(S, x, wallTop, 0.92, 0.3), 4.4, { cap: 0.2 });
  for (let x = wx0 + 2; x < wx1; x += 5.2) cv.pencil([[x, wallTop + 9], [x, wallTop + 14.5]], S.dark(wcol(x, wallTop + 10), 0.5), 1.2, { press: 0.8 });
  cv.pencil(cv.line(wx0, wallTop + 7.5, wx1, wallTop + 7.5, 0.4), S.lit(wcol(CX, wallTop), 0.34), 1.7, { press: 0.85 });
  // The lower part of the wall leans out. A pale line shows the change.
  cv.pencil(cv.line(wx0, foot - 19, wx1, foot - 19, 0.5), S.lit(wcol(CX, foot), 0.3), 1.6, { press: 0.8 });
  cv.scumble([wx0, wallTop + 16, wx1, foot], "pencil", { angle: 0.02, jitter: 0.06, len: [7, 20], width: [1.2, 1.9], gap: 7.5, color: (x, y) => (R() < 0.6 ? S.dark(wcol(x, y), 0.24) : S.lit(wcol(x, y), 0.2)), cj: 0.03, press: 0.75 });
  for (let i = 0; i < 9; i++) {
    const x = wx0 + 44 + i * 44;
    if (Math.abs(x - BF[0]) > 20) pane(S, x, wallTop + 22, 2.2, 6, wcol(x, wallTop + 22), R() * 0.8);
  }
  // The gate, on the line of the bridge.
  const gx = BF[0] + 2;
  cv.hatch(rect(gx - 7, foot - 22, gx + 7, foot + 3), "oilPastel", hour === "day" ? S.dark(ramp(C.castle, 0), 0.4) : mix(P.lamp, P.hot, 0.3), { angle: 1.56, width: 4, spacing: 2.4, maxLen: 30, over: [-0.5, 0.5] });
  cv.oilPastel([[gx - 9.5, foot + 2], [gx - 9.5, foot - 22], [gx, foot - 30], [gx + 9.5, foot - 22], [gx + 9.5, foot + 2]], stone(S, gx, foot, 0.8, night ? 0.4 : 0), 3);
  // Trees of the park at the two sides of the castle.
  for (const k of [-1, 1]) for (let i = 0; i < 5; i++) plane(S, CX + k * (252 + i * 13), foot - 22 + (i % 2) * 14, 19);
  S.cut();
  for (const k of [-1, 1]) roundTower(S, { x: CX + k * 224, r: 38, yt: wallTop - 5, yb: foot + 5, e: 5.5, base: 0.34, panes: 2 });

  if (night) {
    // Warm mist of light at the foot of the walls.
    for (let i = 0; i < 26; i++) {
      const x = R.range(wx0 - 20, wx1 + 20);
      const y = foot - R.range(-3, 16);
      cv.softPastel(cv.line(x - R.range(14, 50), y, x + R.range(14, 50), y + R.range(-2, 2), 0.5), P.lamp, R.range(3, 6), { press: 0.36 });
    }
  }
  S.cut();
}

// Plane tree of the river road: a round crown of dabs on a thin trunk.
function plane(S, x, y, s) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const side = S.light[0] < x ? -1 : 1;
  cv.pencil(cv.line(x, y, x + R.range(-1.5, 1.5), y - s * 0.9, 0.4), C.bark[1], Math.max(1.3, s * 0.1));
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, 6.28);
    const d = Math.sqrt(R()) * s * 0.55;
    const [dx, dy] = [Math.cos(a) * d * 1.2, Math.sin(a) * d * 0.8];
    const l = 0.5 + 0.28 * R() - (dy / s) * 0.7 + (dx / s) * side * 0.5;
    const c = ramp(C.pine, l);
    cv.dot(x + dx, y - s * 1.12 + dy, s * R.range(0.22, 0.36), hour === "dusk" && l > 0.78 ? mix(c, P.sun, 0.25) : c, { grain: 0.45 });
  }
}

// The river wall of the far bank, with the stairs, the quay, the road trees and the lamps.
function embankment(S) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const night = hour === "night";
  cv.layer = 4;
  const topAt = (x) => yFar(x) - wallH(x);
  const k = hour === "day" ? 0.56 : hour === "dusk" ? 0.34 : 0.5;
  const wallAt = (x, y) => S.dark(stone(S, x, y, k - 0.2 * clamp((y - topAt(x)) / wallH(x)), night ? 0.34 * sm(yFar(x), topAt(x), y) : 0), 0.05 + 0.2 * sm(yFar(x) - 10, yFar(x), y + 5 * fbm(x / 30, 1.5, 71, 2)));
  cv.hatch([[S.x0, topAt(S.x0)], [S.x1, topAt(S.x1)], [S.x1, yFar(S.x1)], [S.x0, yFar(S.x0)]], "oilPastel", wallAt, { angle: 1.56, width: 6.4, spacing: 3.5, maxLen: 34, over: [-0.5, 0.5], cj: 0.025 });
  cv.scumble([S.x0, 985, S.x1, 1045], "pencil", { angle: 1.57, jitter: 0.06, len: [8, 22], width: [1.3, 2.1], gap: 9, mask: (x, y) => (y > topAt(x) + 3 && y < yFar(x) ? 1 : 0), color: (x, y) => S.dark(wallAt(x, y), 0.26), cj: 0.03, press: 0.75 });
  cv.oilPastel(cv.line(S.x0, topAt(S.x0), S.x1, topAt(S.x1), 0.8), stone(S, 0, 0, 1, night ? 0.3 : 0), 2.8, { span: 0.3 });
  cv.dryBrush(cv.line(S.x0, yFar(S.x0) + 0.5, S.x1, yFar(S.x1) + 0.5, 0.8), S.dark(ramp(C.river, 0), 0.4), 3, { press: 1.05, span: 0.3 });
  // Quay at the foot of the wall, at the right of the bridge.
  const quay = hour === "day" ? ramp(C.ochre, 0.8) : hour === "dusk" ? ramp(C.ochre, 0.45) : mix(ramp(C.ochre, 0.7), P.lamp, 0.3);
  cv.oilPastel(cv.line(BF[0] + 26, yFar(BF[0] + 26) - 2, 930, yFar(930) - 2, 0.6), quay, 4.6, { span: 0.2 });
  for (let i = 0; i < 16; i++) {
    const x = R.range(BF[0] + 40, 920);
    cv.dot(x, yFar(x) - 4.6, R.range(1.6, 3), ramp(C.pine, R.range(0.4, 0.9)), { grain: 0.4 });
  }
  // Stairs from the road to the quay.
  const [sx0, sx1] = [BF[0] + 30, BF[0] + 96];
  cv.pencil(cv.line(sx0, topAt(sx0) + 2, sx1, yFar(sx1) - 4, 0.3), stone(S, sx0, 0, 1, night ? 0.4 : 0), 2.6, { press: 0.95 });
  cv.pencil(cv.line(sx0 + 2, topAt(sx0) + 5.5, sx1 + 1, yFar(sx1) - 1, 0.3), S.dark(wallAt(sx0, yFar(sx0) - 8), 0.4), 1.7, { press: 0.8 });
  S.cut();
  // Plane trees on the road. The front of the castle stays clear.
  for (let x = S.x0 + 6; x < S.x1; ) {
    const s = R.range(15, 21) * (1 + (500 - x) * 0.0004);
    const gap = R();
    if ((x < CX - 268 || x > CX + 268) && gap > 0.12) plane(S, x, topAt(x) + 1, s);
    x += s * R.range(0.95, 1.5);
  }
  S.cut();
  // Lamps of the road. They show in the water at night.
  const lamps = [];
  for (let i = Math.ceil((S.x0 - 20) / 64); lampX(i) < S.x1; i++) {
    const x = lampX(i);
    const y = topAt(x) - 11;
    cv.pencil([[x, topAt(x)], [x, y]], P.ink, 1.3, { press: 0.85 });
    cv.dot(x, y - 1, 2.1, hour === "day" ? S.lit(P.cloud[4], 0.3) : P.lamp, { grain: 0.2 });
    if (hour !== "day") {
      cv.softPastel(cv.line(x - 13, y + 5, x + 13, y + 5, 0.4), P.lamp, 4, { press: night ? 0.42 : 0.3 });
      lamps.push([x, y - 1, 2.6]);
    }
  }
  if (lamps.length) twinkle(S, lamps, { seed: 5, keep: 5 });
  S.cut();
}

// A point on the water line of the bridge, and the top of its parapet.
const bridgeFoot = (t) => [BF[0] + (BN[0] - BF[0]) * t, BF[1] + (BN[1] - BF[1]) * t];
const bridgeTop = (t) => [bridgeFoot(t)[0], bridgeFoot(t)[1] - bridgeH(t)];
// From the near parapet to the far parapet.
const bridgeWide = (t) => [-(9 + 5 * t), -(5.5 + 3 * t)];

// Ponte Sant'Angelo: five arches of pale stone, the road, the parapets and the angel statues.
function bridge(S) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const night = hour === "night";
  cv.layer = 5;
  const k = hour === "day" ? 0.72 : hour === "dusk" ? 0.3 : 0.45;
  const tOf = (x) => clamp((BF[0] - x) / (BF[0] - BN[0]));
  const faceAt = (x, y) => {
    const t = tOf(x);
    const up = clamp((bridgeFoot(t)[1] - y) / bridgeH(t));
    return stone(S, x, y, k + 0.1 * up, night ? 0.16 + 0.3 * up : 0);
  };
  const far = (t) => [bridgeTop(t)[0] + bridgeWide(t)[0], bridgeTop(t)[1] + bridgeWide(t)[1]];
  const marble = (t, back) => (hour === "day" ? S.lit(ramp(C.trav, 1), back ? 0 : 0.3) : hour === "dusk" ? (back ? mix(ramp(C.trav, 0.75), P.sun, 0.45) : mix(ramp(C.trav, 0.82), P.sun, 0.2)) : mix(ramp(C.trav, 1), mix(P.hot, P.lamp, 0.6), back ? 0.3 : 0.45));
  // A statue: a base, a body and one wing.
  const statue = (p, s, t, back) => {
    const c = marble(t, back);
    cv.oilPastel([[p[0], p[1] + 1], [p[0], p[1] - s * 0.36]], back ? S.dark(c, 0.14) : c, s * 0.34, { cap: 0.2 });
    cv.oilPastel([[p[0], p[1] - s * 0.36], [p[0] + 0.3, p[1] - s * 0.94]], c, s * 0.2, { cap: 0.3 });
    cv.pencil([[p[0] + 0.4, p[1] - s * 0.74], [p[0] + s * 0.26, p[1] - s * 0.98], [p[0] + s * 0.2, p[1] - s * 1.1]], c, Math.max(1.2, s * 0.11), { press: 0.95 });
    cv.dot(p[0] + 0.2, p[1] - s * 1.0, Math.max(1, s * 0.09), c, { grain: 0.2 });
  };
  const posts = [0.012, 0.145, 0.36, 0.575, 0.79, 0.915];
  // The far parapet and its statues go in first.
  cv.pencil(cv.line(...far(0), ...far(1), 0.5), stone(S, 300, 1000, 0.9, night ? 0.4 : 0), 2.4, { press: 0.9 });
  for (const t of posts) statue(far(t), 11 + 8 * t, t, true);
  // The road.
  const road = hour === "day" ? S.lit(ramp(C.trav, 0.86), 0.2) : hour === "dusk" ? mix(ramp(C.trav, 0.7), P.sun, 0.3) : mix(ramp(C.trav, 0.6), P.lamp, 0.5);
  cv.hatch([bridgeTop(0), bridgeTop(1), far(1), far(0)], "oilPastel", road, { angle: Math.atan2(BN[1] - BF[1], BN[0] - BF[0]), width: 3.6, spacing: 2.2, maxLen: 90, over: [-1, 1], cj: 0.02 });
  // The side with the arches.
  cv.hatch([bridgeTop(0), bridgeTop(1), bridgeFoot(1), bridgeFoot(0)], "oilPastel", faceAt, { angle: 1.56, width: 6, spacing: 3.3, maxLen: 40, over: [-0.5, 0.5], cj: 0.025 });
  const shade = night ? S.dark(ramp(C.river, 0), 0.5) : S.dark(ramp(C.river, 0), hour === "dusk" ? 0.5 : 0.62);
  for (const [t0, t1, crown] of ARCHES) {
    const [mid, half] = [(t0 + t1) / 2, (t1 - t0) / 2];
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI;
      const t = mid + half * Math.cos(a);
      const [x, y] = bridgeFoot(t);
      pts.push([x, y - Math.sin(a) ** 0.8 * crown * bridgeH(t)]);
    }
    // The opening is dark at the top. The water shows at the foot.
    const water = S.riverAt(...bridgeFoot(mid));
    cv.hatch(pts, "oilPastel", (x, y) => mix(S.dark(water, 0.3), shade, sm(0.08, 0.42, (bridgeFoot(tOf(x))[1] - y) / (crown * bridgeH(mid)))), { angle: 1.56, width: 4.4, spacing: 2.5, maxLen: 40, over: [-0.5, 0.5], cj: 0.02 });
    // The stones of the arch, and the inner face at the side that is far from the viewer.
    cv.pencil(pts, stone(S, pts[7][0], pts[7][1], 1, night ? 0.4 : 0), 1.9, { press: 0.9 });
    cv.pencil(pts.slice(8, 14).map(([x, y]) => [x + 2.2, y + 1.2]), stone(S, pts[10][0], pts[10][1], 0.2, night ? 0.2 : 0), 2.4, { press: 0.85 });
  }
  // Piers: a pale edge and a foot in the water.
  for (const t of [0.145, 0.36, 0.575, 0.79]) {
    const [x, y] = bridgeFoot(t);
    const h = bridgeH(t);
    cv.oilPastel([[x + 1, y - h * 0.5], [x + 2.5, y]], stone(S, x, y, 1, night ? 0.36 : 0), 3 + 2.4 * t, { cap: 0.2 });
    cv.pencil([[x - 2 - 2 * t, y - h * 0.46], [x - 1 - 2 * t, y]], S.dark(faceAt(x, y - 4), 0.34), 1.6, { press: 0.8 });
    cv.oilPastel(cv.line(x - 5 - 4 * t, y + 1, x + 7 + 4 * t, y + 1, 0.3), stone(S, x, y, 0.5, night ? 0.2 : 0), 3, { press: 0.95 });
  }
  // The near parapet: a pale top, and the shade of its small columns.
  const lean = (dy) => cv.line(bridgeTop(0)[0], bridgeTop(0)[1] + dy, bridgeTop(1)[0], bridgeTop(1)[1] + dy, 0.5);
  cv.oilPastel(lean(0.5), stone(S, 300, 1000, 1, night ? 0.5 : 0), 2.8, { span: 0.25 });
  for (let t = 0.02; t < 0.99; t += 0.016) {
    const [x, y] = bridgeTop(t);
    cv.pencil([[x, y + 2.2], [x, y + 5.5 + 2 * t]], S.dark(faceAt(x, y + 4), 0.42), 1.2, { press: 0.75 });
  }
  cv.pencil(lean(7.5), S.lit(faceAt(330, 1040), 0.2), 1.5, { press: 0.8 });
  for (const t of posts) statue(bridgeTop(t), 13 + 10 * t, t, false);
  S.cut();
  // Lamps on the parapet.
  const lamps = [];
  for (const t of [0.08, 0.25, 0.47, 0.68, 0.85]) {
    const [x, y] = bridgeTop(t);
    const s = 9 + 6 * t;
    cv.pencil([[x, y], [x, y - s]], P.ink, 1.3, { press: 0.9 });
    cv.dot(x, y - s - 1, 1.6 + t, hour === "day" ? S.lit(P.cloud[4], 0.3) : P.lamp, { grain: 0.2 });
    if (hour !== "day") {
      cv.softPastel(cv.line(x - 9, y - 1, x + 9, y, 0.4), P.lamp, 3.6, { press: night ? 0.5 : 0.34 });
      lamps.push([x, y - s - 1, 2 + 1.2 * t]);
    }
  }
  if (lamps.length) twinkle(S, lamps, { seed: 6, keep: 5 });
  S.cut();
  // People on the road. They go in the two directions.
  const W = rng(909 * 5 + 2);
  const walkers = [];
  for (let i = 0; i < (night ? 6 : 13); i++) walkers.push([W(), (W() < 0.5 ? -1 : 1) * W.range(0.008, 0.017), W.range(0.2, 0.8), W.pick([P.ink, P.hot, P.cloud[6], C.pine[2], P.sky[0], C.terra[1]])]);
  S.sprites.push({
    seed: 65,
    keep: 5,
    draw(ov, t) {
      for (const [t0, speed, lane, color] of walkers) {
        const u = (((t0 + speed * t) % 1) + 1) % 1;
        const [x, y] = bridgeTop(u);
        const [wx, wy] = bridgeWide(u);
        const s = 4.4 + 3.4 * u;
        const [px, py] = [x + wx * lane, y + wy * lane + 2];
        ov.oilPastel([[px, py], [px + Math.sin(t * 6 + t0 * 40) * 0.4, py - s]], color, s * 0.42, { cap: 0.3, press: 1.1 });
        ov.dot(px, py - s - 0.8, s * 0.2, night ? P.cloud[4] : P.wood[2], { grain: 0.2 });
      }
    },
  });
}

// The Tiber. The water shows the sky, the river wall, the castle and the bridge. The small waves move.
function river(S) {
  const { cv, R, P, hour } = S;
  const C = S.C;
  const night = hour === "night";
  const foot = yFar(CX) - wallH(CX) - 5;
  S.riverAt = (x, y, t = 0) => {
    const yf = yFar(x);
    const v = clamp((y - yf) / (yNear(x) - yf));
    const sky = S.skyAt(x + (vnoise(x / 40, y / 7, 3) - 0.5) * 50, yh - 30 - v * 260);
    let c = mix(ramp(C.river, 0.16 + 0.62 * v), sky, hour === "dusk" ? 0.56 : 0.4);
    // The mirror image is broken by the waves.
    const br = fbm((x + t * 5) / 34, y / 4.2 + t * 0.07, 9, 2);
    const open = sm(0.34, 0.56, br);
    // Height above the water of the point that shows here.
    const hgt = (y - yf) / 0.5;
    const u = (x - CX) / DR;
    let m = null;
    if (hgt < wallH(x)) m = stone(S, x, yf - hgt, hour === "day" ? 0.6 : 0.3, night ? 0.3 : 0);
    else if (Math.abs(u) < 1 && hgt < yf - (foot - 140) + 13 * Math.sqrt(1 - u * u)) m = brick(S, x, yf - hgt, 0.5 - 0.3 * u * (S.light[0] < CX ? 1 : -1), 0.6);
    else if (Math.abs(x - CX) < 250 && hgt < yf - (foot - 56)) m = brick(S, x, yf - hgt, 0.55, 0.8);
    if (m) c = mix(c, m, (night ? 0.8 : 0.62) * open * (1 - 0.35 * v));
    // The bridge: the pale side, with the dark arches.
    if (x > BN[0] && x < BF[0]) {
      const tb = (BF[0] - x) / (BF[0] - BN[0]);
      const d = (y - bridgeFoot(tb)[1]) / (bridgeH(tb) * 0.62);
      if (d > 0 && d < 1) {
        let dark = false;
        for (const [t0, t1, crown] of ARCHES) {
          const q = (tb - (t0 + t1) / 2) / ((t1 - t0) / 2);
          if (Math.abs(q) < 1 && d < crown * Math.sqrt(1 - q * q)) dark = true;
        }
        c = dark ? mix(c, S.dark(ramp(C.river, 0), 0.4), 0.5 * (1 - d * 0.5)) : mix(c, stone(S, x, y, hour === "day" ? 0.7 : 0.3, night ? 0.3 : 0), 0.5 * open * (1 - d * 0.6));
      }
    }
    if (hour !== "day") {
      // The lamps of the road make long lines of light. The sun or the moon makes a path.
      const dx = Math.abs(((((x - 20) % 64) + 64 + 32) % 64) - 32);
      c = mix(c, P.lamp, (night ? 0.8 : 0.5) * sm(2.4 + 5 * v, 0.6, dx) * sm(0.3, 0.5, br) * (1 - 0.5 * v));
      const g = Math.exp(-(((x - S.sun.x) / (16 + 36 * v)) ** 2));
      c = mix(c, P.sun, g * sm(0.44, 0.62, fbm((x - t * 3) / 12, y / 2.6, 17, 2)) * (night ? 0.6 : 0.9));
    }
    const w = fbm((x + t * (6 + 10 * v)) / (34 + 60 * v), y / (2.6 + 5 * v) + t * 0.05, 19, 2);
    return mix(mix(c, ramp(C.river, 0), sm(0.56, 0.76, w) * 0.34), P.glow, sm(0.36, 0.2, w) * (night ? 0.12 : 0.24));
  };
  cv.layer = 3;
  const inWater = (x, y) => (y > yFar(x) - 2 && y < yNear(x) + 6 ? 1 : 0);
  const box = [S.x0, 1000, S.x1, 1170];
  cv.scumble(box, "block", { angle: -0.035, jitter: 0.04, len: [44, 100], width: [8, 13], gap: 0.5, lap: 0.55, mask: inWater, color: S.riverAt, cj: 0.015 });
  // One small wave: a short level mark. Near marks are longer.
  const wave = (G, x, y, t, opts) => {
    const v = clamp((y - yFar(x)) / (yNear(x) - yFar(x)));
    const c = S.riverAt(x, y, t);
    const u = G();
    const l = G.range(5 + 9 * v, 14 + 26 * v);
    cv.softPastel(cv.line(x - l, y + l * 0.036, x + l, y - l * 0.036, 1.4), u < 0.3 ? mix(c, ramp(C.river, 0), 0.3) : u < 0.52 ? mix(c, P.glow, night ? 0.14 : 0.28) : c, G.range(1.6 + 1.4 * v, 2.6 + 2.6 * v), { press: G.range(0.85, 1.1), ...opts });
  };
  const before = cv.queue ? cv.queue.length : 0;
  cv.group(() => {
    for (let gy = 1004; gy < 1166; gy += 5.2) {
      for (let gx = S.x0; gx < S.x1; gx += 17) {
        const [x, y] = [gx + R() * 17, gy + R() * 5.2];
        if (inWater(x, y) && y < yNear(x) + 2) wave(R, x, y, 0);
      }
    }
  });
  const marks = cv.queue ? cv.queue.length - before : 900;
  S.cut();
  // All wave marks are painted again in about 40 seconds.
  const L = rng(909 + 17);
  const rate = Math.max(8, marks / 40);
  let due = 0;
  S.live.push((t, dt) => {
    cv.layer = 3;
    due += rate * dt;
    for (; due >= 1; due--) {
      const x = L.range(cv.x0, cv.x1);
      wave(L, x, yFar(x) + 2 + (yNear(x) - yFar(x) - 2) * L(), t, { keep: 3 });
    }
  });
  // A river boat. It goes down the river and into the middle arch of the bridge.
  // Then the next boat starts at the right edge. Left of the arch, the bridge hides the water.
  const hull = night ? P.cloud[5] : hour === "dusk" ? S.lit(P.wall[3], 0.2) : P.sun;
  S.sprites.push({
    seed: 64,
    keep: 3,
    draw(ov, t) {
      const span = cv.x1 + 100 - 300;
      const x = cv.x1 + 100 - (((240 + t * 8) % span) + span) % span;
      const y = yFar(x) + (yNear(x) - yFar(x)) * 0.53;
      const s = 0.8 + (500 - x) * 0.0004;
      const p = (a, b) => [x + a * s, y - a * s * 0.042 + b * s + Math.sin(t * 1.3) * 0.3];
      for (let i = 0; i < 4; i++) ov.softPastel([p(20 + i * 12, 2.5 + i * 0.8), p(34 + i * 13 + Math.sin(t * 2 + i) * 3, 2.5 + i * 1.4)], S.lit(S.riverAt(x, y), 0.5), (2.6 - i * 0.4) * s, { press: 0.9 - i * 0.14 });
      ov.oilPastel([p(-19, 0), p(18, 0)], hull, 5.4 * s, { cap: 0.3 });
      ov.oilPastel([p(-18, 2.6), p(17, 2.6)], S.dark(P.sea[0], 0.2), 2 * s, { cap: 0.3 });
      ov.oilPastel([p(-9, -4.6), p(13, -4.6)], S.dark(hull, 0.12), 4.6 * s, { cap: 0.2 });
      ov.pencil([p(-8, -4.6), p(12, -4.6)], hour === "day" ? P.ink : P.lamp, 1.7 * s, { press: 0.95 });
      ov.oilPastel([p(-10, -7.6), p(14, -7.6)], hour === "night" ? P.cloud[3] : P.hot, 1.8 * s, { cap: 0.2 });
    },
  });
}

function draw(cv, hour) {
  const light = { day: [-260, -200], dusk: [318, 772], night: [820, 200] }[hour];
  const S = scene(cv, hour, { seed: 909, yh, light, glowR: hour === "day" ? 520 : 310 });
  const { P, R } = S;
  const C = (S.C = colors(hour));
  if (hour === "night") {
    S.sun = { x: S.sx(0.74), y: S.sy(0.3), r: 26, moon: true };
    S.light = [S.sun.x, S.sun.y];
  } else if (hour === "dusk") S.sun = { x: 318, y: 772, r: 36 };

  // Ground tone of the city: warm walls and tiles, with the color of the air at the far edge.
  const cityAt = (x, y) => {
    const z = clamp((y - yh) / 400);
    const warm = mix(ramp(C.ochre, 0.3 + 0.4 * fbm(x / 120, y / 40, 7, 2)), ramp(C.terra, 0.5), sm(0.45, 0.6, fbm(x / 70, y / 26, 23, 2)) * 0.7);
    return mix(warm, S.skyAt(x, yh - 14), (1 - z) ** 1.4 * 0.6);
  };

  const clouds = [...lowClouds(S, 5), ...skyClouds(S, [[230, 540, 250, 110, 7, 21], [800, 440, 210, 90, 6, 22], [520, 250, 300, 120, 8, 23], [120, 60, 240, 100, 6, 24]])];
  paintSky(S, clouds, { cirrus: 20, stars: 1100 });

  // Far hills.
  cv.layer = 2;
  const hillH = (x) => 22 + 30 * fbm(x / 300, 2.2, 31, 3) + 28 * Math.exp(-(((x - 900) / 280) ** 2)) + 18 * Math.exp(-(((x + 60) / 200) ** 2));
  const onHill = (x, y) => (y > yh + 8 - hillH(x) ? 1 : 0);
  const hillAt = (x, y) => mix(ramp(C.hills, 0.25 + 0.6 * clamp((y - (yh + 8 - hillH(x))) / 46) + (fbm(x / 60, y / 14, 3, 2) - 0.5) * 0.5), S.skyAt(x, yh - 40), 0.2);
  const hills = [S.x0, yh - 86, S.x1, yh + 16];
  cv.scumble(hills, "block", { angle: -0.04, jitter: 0.06, len: [30, 70], width: [8, 13], gap: 0.5, lap: 0.6, mask: onHill, color: hillAt, cj: 0.015 });
  cv.scumble(hills, "softPastel", { angle: 0.5, len: [10, 26], width: [3, 5], gap: 1.7, mask: onHill, color: (x, y) => (R() < 0.5 ? S.dark(hillAt(x, y), 0.14) : hillAt(x, y - 8)), cj: 0.03 });
  S.cut();

  // The city: dark ground first, then far roofs as small marks.
  // The ground is one layer below the houses. In an hour change, it does not cover them.
  cv.layer = 3;
  cv.scumble([S.x0, yh + 2, S.x1, 1250], "block", { angle: 0, jitter: 0.05, len: [50, 110], width: [14, 22], gap: 0.5, lap: 0.55, color: (x, y) => S.dark(cityAt(x, y), 0.34), cj: 0.02 });
  cv.scumble([S.x0, yh + 2, S.x1, yh + 44], "oilPastel", { angle: 0, jitter: 0.05, len: [5, 15], width: [2.2, 4.2], gap: 1.5, lap: 0.8, color: (x, y) => mix(R() < 0.3 ? ramp(C.terra, R.range(0.4, 0.9)) : ramp(C.ochre, R.range(0.3, 1)), S.skyAt(x, yh - 14), 0.52 - (y - yh) * 0.003), cj: 0.03 });
  S.cut();
  river(S);
  S.washAt = (x, y) => (y < yh ? S.skyAt(x, y) : y > yFar(x) && y < yNear(x) ? S.riverAt(x, y) : S.dark(cityAt(x, Math.min(y, 1180)), 0.12));

  // The far bank: houses in rows from far to near, with trees between them. Domes and towers go in at their depth.
  cv.layer = 4;
  const depthY = (z) => yh + 12 + 372 * z ** 1.3;
  // No house stands on the ground of the castle.
  const clear = (x, y, w = 0) => !(Math.abs(x - CX) < 292 + w / 2 && y > 902);
  const items = [];
  const rows = 12;
  for (let i = 0; i < rows; i++) {
    const z = 0.07 + 0.485 * (i / (rows - 1));
    const s = 8 + 62 * z ** 1.15;
    for (let x = S.x0 - R() * s; x < S.x1 + s; ) {
      const big = R();
      const w = s * R.range(0.8, 1.7) * (big < 0.1 ? 1.6 : 1);
      const h = s * R.range(0.55, 1.5) * (big > 0.88 ? 1.5 : 1);
      const u = R();
      const y = depthY(z) + R.range(-0.2, 0.2) * s;
      if (clear(x + w / 2, y, w)) {
        if (u > 0.2) items.push({ kind: building, y, x: x + w / 2, w, h, z });
        else if (u > 0.07) items.push({ kind: grove, y, x: x + w / 2, s: s * 0.8, z });
      }
      x += w * R.range(0.92, 1.12);
    }
  }
  const [el, er] = [cv.x0, cv.x1];
  for (const [x, z, r, tile] of [[el + 100, 0.46, 30, 0], [395, 0.16, 12, 1], [840, 0.22, 16, 0], [er - 120, 0.5, 32, 0], [-40, 0.2, 13, 0], [1065, 0.2, 15, 1], [960, 0.38, 20, 0], [1180, 0.36, 20, 0], [-160, 0.38, 20, 1], [60, 0.3, 15, 0]]) {
    const s = 8 + 62 * z ** 1.15;
    if (!clear(x, depthY(z), r * 3.1)) continue;
    // The church below the dome: a plain block with a front.
    items.push({ kind: building, y: depthY(z) + 1, x, w: r * 3.1, h: s * 1.5, z });
    items.push({ kind: dome, y: depthY(z) - s * 1.5 + 2, x, r: r * 1.3, z, tile: !!tile, drum: 0.8 });
  }
  for (const [x, z, w, h, spire] of [[330, 0.28, 11, 64, 0], [690, 0.24, 9, 52, 0], [er - 236, 0.44, 15, 96, 1], [el + 250, 0.5, 17, 70, 0], [95, 0.24, 9, 52, 0], [600, 0.2, 8, 42, 1], [925, 0.2, 7, 40, 0], [1130, 0.5, 18, 105, 0], [-120, 0.5, 18, 105, 0], [880, 0.42, 14, 88, 0]]) {
    if (clear(x, depthY(z), w * 2)) items.push({ kind: tower, y: depthY(z), x, w: w * 1.2, h: h * 1.3, z, spire: !!spire });
  }
  // St Peter's is far away, at the left of the castle.
  items.push({ kind: (S2) => stPeters(S2, 205, yh + 30, 40), y: yh + 20 });
  items.sort((a, b) => a.y - b.y);
  S.cut();
  for (const item of items) item.kind(S, item);
  S.cut();

  // Street lamps and a warm mist of light at dusk and at night.
  const lamps = [];
  const L = rng(909 + 5);
  for (let i = 0; i < (90 * (S.x1 - S.x0)) / 1060; i++) {
    const near = L() < 0.3;
    const z = 0.1 + 0.44 * L() ** 0.8;
    const x = L.range(S.x0, S.x1);
    const y = near ? yNear(x) + L.range(26, 90) : depthY(z) - (8 + 62 * z) * L.range(0.1, 0.9);
    if (near || !(Math.abs(x - CX) < 270 && y > 836)) lamps.push([x, y, near ? L.range(2, 3) : 1.1 + 1.9 * z, near]);
  }
  const lampDots = (near) => {
    for (const [x, y, r, n] of lamps) {
      if (n !== near || hour === "day") continue;
      cv.dot(x, y, r, P.lamp, { grain: 0.2 });
      if (r > 1.9) cv.softPastel(cv.line(x - r * 4, y + R.range(-2, 2), x + r * 4, y + R.range(-2, 2), 0.4), P.lamp, r * 1.2, { press: 0.45 });
    }
    S.cut();
  };
  lampDots(false);

  castle(S);
  embankment(S);
  bridge(S);

  // The near bank: plane trees at the water, then the roofs below the terrace.
  cv.layer = 5;
  for (let x = S.x0 + 10; x < S.x1; ) {
    const s = R.range(18, 34) * (1 + (500 - x) * 0.0003);
    if (R() > 0.16) plane(S, x, yNear(x) + 24 + R.range(-3, 5), s);
    else R();
    x += s * R.range(0.8, 1.35);
  }
  S.cut();
  // A house and trees hide the near end of the bridge.
  const front = [{ kind: building, y: BN[1] + 46, x: BN[0] - 2, w: 58, h: 96, z: 0.95 }];
  for (const dx of [-44, 36]) front.push({ kind: (S2) => plane(S2, BN[0] + dx, BN[1] + 30, 32), y: BN[1] + 47 });
  for (const [yb, s] of [[1182, 50], [1236, 66]]) {
    for (let x = S.x0 - R() * s; x < S.x1 + s; ) {
      const w = s * R.range(0.8, 1.7);
      const u = R();
      // A roof does not go above the water.
      const h = Math.min(s * R.range(0.5, 1.25), yb - yNear(x + w / 2) - 28);
      if (h > 16 && u > 0.14) front.push({ kind: building, y: yb + R.range(-0.1, 0.1) * s, x: x + w / 2, w, h, z: 0.95 });
      else if (u > 0.04) front.push({ kind: grove, y: yb - 6, x: x + w / 2, s: s * 0.7, z: 0.95 });
      x += w * R.range(0.92, 1.12);
    }
  }
  front.push({ kind: tower, y: 1236, x: er - 330, w: 24, h: 104, z: 0.95, spire: false });
  front.push({ kind: dome, y: 1178, x: el + 330, r: 34, z: 0.95, drum: 0.7 });
  front.sort((a, b) => a.y - b.y);
  S.cut();
  for (const item of front) item.kind(S, item);
  S.cut();
  lampDots(true);
  if (hour !== "day") twinkle(S, lamps.filter((_, i) => i % 3 === 0).map(([x, y, r]) => [x, y, r * 1.1]), { seed: 2, keep: 5 });

  // Starlings: a cloud of small birds that changes its shape and goes across the sky.
  const flock = { day: 110, dusk: 520, night: 60 }[hour];
  const F = rng(909 * 3 + 1);
  const stars = [];
  for (let i = 0; i < flock; i++) stars.push([F.gauss(), F.gauss(), F.range(0, 6.28), F.range(1.1, 2.2)]);
  const [fx0, fx1, fy0, fy1] = [S.sx(0.16), S.sx(0.84), S.sy(0.12), yh - 150];
  S.sprites.push({
    seed: 62,
    keep: 1,
    draw(ov, t) {
      const color = hour === "night" ? P.cloud[4] : P.ink;
      const cx = (fx0 + fx1) / 2 + ((fx1 - fx0) / 2) * Math.sin(t * 0.11 + 1);
      const cy = (fy0 + fy1) / 2 + ((fy1 - fy0) / 2) * Math.sin(t * 0.17 + 2.2) * 0.8;
      // The cloud is long, then round, then long again. A wave goes through it.
      const long = 170 + 100 * Math.sin(t * 0.31);
      const thick = 60 + 32 * Math.sin(t * 0.43 + 1.4);
      const turn = 0.5 * Math.sin(t * 0.23) + 0.3 * Math.sin(t * 0.07 + 2);
      const [ca, sa] = [Math.cos(turn), Math.sin(turn)];
      for (const [u, v, ph, r] of stars) {
        const a = u * long * 0.5;
        const bend = Math.sin(u * 1.5 + t * 0.9) * thick * 0.9 + Math.sin(u * 3.1 - t * 1.3 + ph * 0.2) * 12;
        const b = v * thick * 0.6 * (1 + 0.5 * Math.sin(u * 2.2 + t * 0.6)) + bend;
        const x = cx + a * ca - b * sa + Math.sin(t * 2.1 + ph) * 4;
        const y = cy + a * sa + b * ca + Math.cos(t * 1.7 + ph) * 3;
        if (y < yh - 30) ov.dot(x, y, r, color, { grain: 0.25, press: 0.95 });
      }
    },
  });
  // Swifts near the roofs.
  birds(S, { n: 14, box: [S.sx(0.1), S.sy(0.45), S.sx(0.9), yh - 60], size: [3, 8], seed: 3 });

  // Near trees. They stand in front of the terrace wall, below the viewer. They stay at the sides of the castle.
  cv.layer = 6;
  const wide = cv.x1 - cv.x0;
  cypress(S, Math.min(el + wide * 0.2, 120), 1240, 330, 46, 2);
  const cx2 = Math.max(er - wide * 0.2, 846);
  cypress(S, cx2, 1240, 400, 56, 1);
  cypress(S, cx2 + 50, 1240, 290, 44, 3);
  // The crowns stay in the picture when the window is low.
  const crown = clamp(cv.y0 + 150, 440, 600);
  stonePine(S, { bx: er - 118, by: 1340, cx: er - 150, cy: crown + 70, w: 390, h: 150, seed: 4, back: 1 });
  stonePine(S, { bx: el + 62, by: 1340, cx: el + 150, cy: crown, w: 460, h: 176, seed: 5 });

  // Balustrade of the terrace: rail, balusters, piers, a pot and a lamp.
  cv.layer = 7;
  const [railTop, railLow, foot] = [1206, 1236, 1310];
  const stoneAt = (x, y) => ramp(C.trav, 0.62 + (fbm(x / 70, y / 16, 51, 3) - 0.5) * 0.5);
  const lightLeft = S.light[0] < 500;
  cv.hatch(rect(S.x0, railLow - 2, S.x1, foot + 2), "oilPastel", (x, y) => S.dark(cityAt(x, 1180), 0.66 - 0.16 * ((y - railLow) / (foot - railLow))), { angle: 0, width: 10, spacing: 5, maxLen: 180, over: [-6, 6], jitter: 0.01, cj: 0.03 });
  const piers = [];
  for (let k = Math.ceil((S.x0 - 150) / 365); 150 + 365 * k < S.x1 + 40; k++) piers.push(150 + 365 * k);
  for (let x = S.x0 + ((((150 - S.x0) % 36.5) + 36.5) % 36.5) - 18; x < S.x1; x += 36.5) {
    if (piers.some((px) => Math.abs(px - x) < 40)) {
      R();
      continue;
    }
    // Baluster: a neck, a round belly and two rings.
    const lit = face(S, stoneAt(x, 1270), 1);
    const dim = face(S, stoneAt(x, 1270), 0);
    const k = lightLeft ? -1 : 1;
    cv.oilPastel([[x, railLow], [x, foot]], dim, 9, { cap: 0.3 });
    cv.hatch(ellipse(x, railLow + 46, 12, 20, 0, 14), "oilPastel", dim, { angle: 1.5, width: 5, spacing: 2.8, maxLen: 44, over: [-0.5, 0.5] });
    cv.oilPastel([[x + k * 2.6, railLow + 4], [x + k * 6.4, railLow + 46], [x + k * 2.6, foot - 4]], lit, 6.4, { press: 1.05 });
    cv.pencil([[x - k * 4, railLow + 18], [x - k * 9.4, railLow + 46], [x - k * 4, foot - 14]], S.dark(dim, 0.3), 1.8, { press: 0.8 });
    R();
    for (const y of [railLow + 8, foot - 8]) cv.oilPastel(cv.line(x - 10, y, x + 10, y, 0.2), lit, 4.6);
  }
  cv.hatch(rect(S.x0, railTop, S.x1, railLow), "oilPastel", (x, y) => face(S, stoneAt(x, y), y < railTop + 12 ? 1 : 0.3), { angle: 0, width: 8, spacing: 4.4, maxLen: 220, over: [-8, 8], jitter: 0.004, cj: 0.025 });
  cv.oilPastel(cv.line(S.x0, railTop, S.x1, railTop - 1, 1), hour === "dusk" ? P.sun : S.lit(ramp(C.trav, 1), 0.3), 3.4, { span: 0.4 });
  cv.dryBrush(cv.line(S.x0, railLow + 1, S.x1, railLow + 2, 1), S.dark(ramp(C.trav, 0.2), 0.35), 4.4, { press: 1.05, span: 0.4 });
  cv.hatch(rect(S.x0, foot, S.x1, S.bottom), "oilPastel", (x, y) => face(S, stoneAt(x, y * 2), y < foot + 10 ? 0.9 : 0.2), { angle: 0, width: 9, spacing: 5, maxLen: 200, over: [-8, 8], jitter: 0.004, cj: 0.025 });
  cv.scumble([S.x0, railTop, S.x1, S.bottom], "pencil", { angle: 0.2, jitter: 1.2, len: [8, 26], width: [1.4, 2.2], gap: 9, mask: (x, y) => (y < railLow || y > foot ? 1 : 0), color: (x, y) => S.dark(stoneAt(x, y), 0.4), cj: 0.03, press: 0.75 });
  S.cut();
  const lampAt = [];
  // A lamp post does not stand in front of a pine trunk. That pier gets an urn.
  const trunks = [[er - 146, er - 118], [el + 62, el + 139]];
  const free = (x) => trunks.every(([a, b]) => x < a - 44 || x > b + 44);
  piers.forEach((x, i) => {
    const k = Math.round((x - 150) / 365);
    const [pw, top] = [38, railTop - 16];
    cv.hatch(rect(x - pw, top, x, S.bottom), "oilPastel", (px, py) => face(S, stoneAt(px * 1.7, py), lightLeft ? 1 : 0), { angle: 1.56, width: 9, spacing: 5, maxLen: 120, over: [-1, 2], cj: 0.025 });
    cv.hatch(rect(x, top, x + pw, S.bottom), "oilPastel", (px, py) => face(S, stoneAt(px * 1.7, py), lightLeft ? 0 : 1), { angle: 1.56, width: 9, spacing: 5, maxLen: 120, over: [-1, 2], cj: 0.025 });
    cv.hatch(rect(x - pw - 6, top - 12, x + pw + 6, top + 2), "oilPastel", face(S, ramp(C.trav, 0.9), 1), { angle: 0, width: 6, spacing: 3.4, maxLen: 100, over: [-1, 1], cj: 0.02 });
    cv.dryBrush(cv.line(x - pw - 4, top + 4, x + pw + 4, top + 4, 0.4), S.dark(ramp(C.trav, 0.3), 0.3), 3, { press: 1 });
    cv.hatch(rect(x - pw * 0.6, top + 40, x + pw * 0.6, foot - 10), "pencil", S.dark(ramp(C.trav, 0.4), 0.2), { angle: 0, width: 1.6, spacing: 14, maxLen: 50, over: [-1, 1], press: 0.7 });
    const py = top - 12;
    const sort = ((k % 3) + 3) % 3;
    if (sort === 1) {
      // Pot of baked clay with a low round bush.
      const pot = [[x - 26, py - 44], [x + 26, py - 44], [x + 17, py], [x - 17, py]];
      cv.hatch(pot, "oilPastel", (px) => face(S, ramp(C.terra, 0.72), lightLeft === px < x ? 1 : 0), { angle: 1.5, width: 6, spacing: 3.4, maxLen: 50, over: [-0.5, 1], cj: 0.03 });
      cv.oilPastel(cv.line(x - 29, py - 46, x + 29, py - 46, 0.4), face(S, ramp(C.terra, 0.95), 1), 7);
      cv.pencil(cv.line(x - 20, py - 22, x + 20, py - 22, 0.6), S.dark(ramp(C.terra, 0.3), 0.3), 1.8, { press: 0.8 });
      for (let j = 0; j < 46; j++) {
        const a = R.range(0, 6.28);
        const d = Math.sqrt(R()) * 27;
        const [lx, ly] = [x + Math.cos(a) * d * 1.1, py - 66 + Math.sin(a) * d * 0.82];
        cv.dot(lx, ly, R.range(4.4, 7.4), ramp(C.pine, 0.3 + 0.5 * R() - Math.sin(a) * 0.25 + (lightLeft ? -1 : 1) * Math.cos(a) * 0.15), { grain: 0.45 });
      }
      for (let j = 0; j < 7; j++) cv.dot(x + R.range(-24, 24), py - 66 + R.range(-18, 18), 3.2, hour === "night" ? mix(P.hot, P.ink, 0.45) : P.hot, { grain: 0.25 });
    } else if (sort === 2 && free(x)) {
      // Lamp post of iron with a glass head.
      const top2 = py - 236;
      cv.charcoal(cv.line(x, py, x, top2, 0.6), P.ink, 5.4, { press: 1.3 });
      cv.oilPastel(cv.line(x - 9, py - 4, x + 9, py - 4, 0.2), P.ink, 8);
      cv.oilPastel(cv.line(x - 6, py - 60, x + 6, py - 60, 0.2), P.ink, 4);
      const head = [[x - 12, top2 - 32], [x + 12, top2 - 32], [x + 8, top2], [x - 8, top2]];
      cv.hatch(head, "oilPastel", hour === "day" ? S.lit(P.cloud[4], 0.3) : P.lamp, { angle: 1.5, width: 4, spacing: 2.4, maxLen: 34, over: [-0.5, 0.5] });
      for (const dx of [-12, 12]) cv.pencil([[x + dx, top2 - 32], [x + dx * 0.66, top2]], P.ink, 1.8);
      cv.oilPastel([[x - 15, top2 - 33], [x, top2 - 46], [x + 15, top2 - 33]], P.ink, 4);
      cv.pencil([[x, top2 - 46], [x, top2 - 56]], P.ink, 2);
      if (hour !== "day") {
        for (let j = 0; j < 14; j++) cv.softPastel(cv.line(x - R.range(10, 64), top2 - 16 + R.range(-30, 30), x + R.range(10, 64), top2 - 16 + R.range(-30, 30), 0.6), P.lamp, 3.4, { press: 0.5 });
        lampAt.push([x, top2 - 16, 7]);
      }
    } else {
      // Stone urn: a foot, a round body and a lid.
      const tone = (px) => face(S, ramp(C.trav, 0.8), lightLeft === px < x - 2 ? 1 : 0);
      cv.oilPastel([[x, py], [x, py - 14]], tone(x + 9), 13, { cap: 0.2 });
      cv.hatch(ellipse(x, py - 38, 27, 25, 0, 20), "oilPastel", tone, { angle: 1.5, width: 6, spacing: 3.2, maxLen: 60, over: [-0.5, 0.5], cj: 0.02 });
      cv.oilPastel(cv.line(x - 30, py - 56, x + 30, py - 56, 0.3), face(S, ramp(C.trav, 0.95), 1), 6);
      cv.hatch(ellipse(x, py - 66, 15, 9, 0, 14), "oilPastel", tone, { angle: 0, width: 4, spacing: 2.4, maxLen: 30, over: [-0.5, 0.5] });
      cv.dot(x, py - 78, 5, face(S, ramp(C.trav, 0.9), 1), { grain: 0.25 });
      cv.pencil(spline([[x + (lightLeft ? 22 : -22), py - 56], [x + (lightLeft ? 27 : -27), py - 36], [x + (lightLeft ? 12 : -12), py - 14]], 6), S.dark(ramp(C.trav, 0.3), 0.3), 2, { press: 0.8 });
    }
    S.cut();
  });
  if (lampAt.length) twinkle(S, lampAt, { seed: 4 });
  return S;
}

export default { id: "rome", name: "Rome", alt: "Pastel drawing of the Castel Sant'Angelo in Rome from a terrace, with the Tiber, the bridge of the angels, umbrella pines and a stone balustrade.", frame: { top: 430, bottom: 1333 }, draw };
