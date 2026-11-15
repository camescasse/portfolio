// Dune du Pilat, La Teste-de-Buch: the great dune between the pine forest and the ocean.
// The viewer stands on the ridge. The forest is at the left, the sea and the sandbanks are at the right.
import { clamp, ellipse, fbm, hex, mix, ramp, rng, sm, spline, vnoise } from "../engine.mjs";
import { birds, lowClouds, paintRidge, paintSea, paintSky, sailer, scene, skyClouds, sloop, twinkle, yola } from "../kit.mjs";

const yh = 760;

// Dune sand in light, dune sand in shadow, and pine green. Lists go from dark to light.
const EXTRA = {
  day: {
    lit: ["#dfb98a", "#f1d3a4", "#fbe8c4", "#fff6e0"],
    shade: ["#6a63a2", "#8f7fb6", "#b59cbe", "#dcc0bc"],
    pine: ["#10243e", "#17464c", "#27694e", "#559556", "#a3c474"],
  },
  dusk: {
    lit: ["#c9707a", "#ee9a80", "#fbbf94", "#ffe2b0"],
    shade: ["#2c2a70", "#473f88", "#6f5490", "#a06c90"],
    pine: ["#0e123a", "#172254", "#213a66", "#356274", "#b8706a"],
  },
  night: {
    lit: ["#34407e", "#5464a8", "#8693cc", "#c2cbee"],
    shade: ["#0e1238", "#161d54", "#222f72", "#33448e"],
    pine: ["#06081f", "#0b1232", "#122046", "#1d365e", "#35567e"],
  },
};

// y for each x on a smooth line through the points.
function curve(pts) {
  const s = spline(pts, 8);
  return (x) => {
    let i = 0;
    while (i < s.length - 2 && s[i + 1][0] < x) i++;
    const t = clamp((x - s[i][0]) / (s[i + 1][0] - s[i][0] || 1));
    return s[i][1] + (s[i + 1][1] - s[i][1]) * t;
  };
}

// Upper edge of the dune. The summit is round and wide, near x 470.
const top = curve([[-900, 1420], [-400, 1330], [-170, 1220], [10, 1060], [150, 900], [250, 770], [330, 690], [400, 640], [460, 618], [530, 624], [600, 655], [680, 705], [760, 762], [880, 846], [1040, 930], [1250, 1004], [1500, 1066], [1900, 1140]]);
// The sharp ridge from the summit to the viewer: x for each y. It makes a slow S.
const ridge = curve([[560, 500], [622, 482], [660, 452], [720, 404], [800, 366], [890, 354], [980, 374], [1080, 412], [1180, 432], [1290, 410], [1400, 362], [1500, 320]]);
const crestX = (y) => ridge(Math.max(622, y));
// Size of a thing on the dune: small at the summit, large near the viewer.
const near = (y) => clamp((y - 590) / 740, 0.03, 1.1);

// A person: body, head, legs and a shadow on the sand.
function figure(S, x, y, h, color, shade) {
  const { cv, P, R } = S;
  const lean = R.range(-0.08, 0.08) * h;
  cv.softPastel(cv.line(x - h * 0.1, y + h * 0.04, x - h * 0.75, y + h * 0.16, 0.3), shade, Math.max(1.4, h * 0.16), { press: 0.85 });
  cv.pencil([[x - h * 0.08, y], [x - h * 0.05 + lean * 0.3, y - h * 0.42]], P.ink, Math.max(1.2, h * 0.09));
  cv.pencil([[x + h * 0.08, y], [x + h * 0.04 + lean * 0.3, y - h * 0.42]], P.ink, Math.max(1.2, h * 0.09));
  cv.oilPastel([[x + lean * 0.3, y - h * 0.4], [x + lean, y - h * 0.78]], color, Math.max(1.8, h * 0.24), { cap: 0.4 });
  cv.dot(x + lean * 1.1, y - h * 0.9, Math.max(1.1, h * 0.1), P.ink, { grain: 0.3 });
}

// Maritime pine: a bare trunk that leans, with flat crowns at the top.
// h is the height of the trunk. c is the size of the crown.
function pine(S, E, x, base, h, lean, c = h) {
  const { cv, R } = S;
  const trunk = spline([[x, base], [x + lean * 0.3, base - h * 0.45], [x + lean * 0.8, base - h * 0.8], [x + lean, base - h]], 10);
  cv.charcoal(cv.wobble(trunk, 1.2), E.pine[0], h * 0.03, { press: 1.3 });
  cv.pencil(cv.wobble(trunk.map(([px, py]) => [px + h * 0.012, py]), 0.8), mix(E.pine[4], E.lit[2], 0.4), h * 0.008 + 1.2, { press: 0.8 });
  const [cx, cy] = [x + lean, base - h];
  for (const [dx, dy, rx, ry] of [[-0.2, 0.05, 0.15, 0.04], [0.21, 0.035, 0.16, 0.042], [0, 0, 0.24, 0.058], [0.07, -0.05, 0.15, 0.04], [-0.1, -0.035, 0.12, 0.034]]) {
    const [px, py] = [cx + dx * c, cy + dy * c];
    // Branch from the trunk to the crown.
    cv.pencil(cv.line(cx + R.range(-4, 4), cy + c * 0.1, px, py, 0.8), E.pine[0], c * 0.008 + 1.3);
    cv.hatch(ellipse(px, py, rx * c, ry * c, -0.05), "charcoal", ramp(E.pine, 0.12), { angle: 0.1, width: c * 0.024, spacing: c * 0.012, maxLen: c * 0.2, over: [-2, 3], press: 1.25, cj: 0.03 });
    cv.hatch(ellipse(px + rx * c * 0.12, py - ry * c * 0.45, rx * c * 0.8, ry * c * 0.45, -0.08), "softPastel", ramp(E.pine, 0.5 + 0.3 * R()), { angle: -0.15, width: c * 0.016, spacing: c * 0.014, maxLen: c * 0.12, press: 0.9, cj: 0.05 });
    for (let i = 0; i < 9; i++) {
      const a = R.range(0, Math.PI * 2);
      cv.pencil(cv.line(px + Math.cos(a) * rx * c * 0.8, py + Math.sin(a) * ry * c * 0.8, px + Math.cos(a) * rx * c * 1.2, py + Math.sin(a) * ry * c * 1.25 + 2, 0.5), ramp(E.pine, R.range(0.05, 0.5)), c * 0.008 + 1.3, { taper: 0.7 });
    }
  }
}

// Paraglider: a curved wing, lines and a pilot. tilt turns the wing. keep is the highest layer it goes across.
function glider(ov, P, x, y, s, tilt, color, trim) {
  const [ca, sa] = [Math.cos(tilt), Math.sin(tilt)];
  const at = (u, v) => [x + (u * ca - v * sa) * s, y + (u * sa + v * ca) * s];
  const arc = (lift, n = 9) => Array.from({ length: n }, (_, i) => at(Math.sin((i / (n - 1) - 0.5) * 2.5) * 0.52, -Math.cos((i / (n - 1) - 0.5) * 2.5) * 0.3 + lift));
  const pilot = at(sa * -0.25, 0.86);
  for (const i of [0, 2, 4, 6, 8]) ov.pencil([arc(0.33)[i], pilot], P.ink, 1.1, { press: 0.6, taper: 0 });
  ov.oilPastel(arc(0.3), color, s * 0.13, { taper: 0.55 });
  ov.oilPastel(arc(0.325, 5).slice(1, 4), trim, s * 0.06, { taper: 0.3 });
  ov.pencil(arc(0.36), mix(color, P.ink, 0.5), Math.max(1.2, s * 0.03), { press: 0.9 });
  ov.oilPastel([pilot, [pilot[0] + sa * 2, pilot[1] + s * 0.11]], P.ink, Math.max(1.6, s * 0.06), { cap: 0.4 });
  ov.dot(pilot[0], pilot[1] - s * 0.03, Math.max(1, s * 0.03), P.ink, { grain: 0.3 });
}

function draw(cv, hour) {
  const E = Object.fromEntries(Object.entries(EXTRA[hour]).map(([k, v]) => [k, v.map(hex)]));
  const light = { day: [1350, -300], dusk: [840, yh - 46], night: [800, 300] }[hour];
  const S = scene(cv, hour, { seed: 606, yh, light, refl: { day: 0.3, dusk: 0.62, night: 0.45 }[hour], glowR: hour === "day" ? 520 : 280 });
  const { P, R } = S;
  if (hour === "night") {
    S.sun = { x: 790, y: S.sy(0.34), r: 26, moon: true };
    S.light = [S.sun.x, S.sun.y];
  } else if (hour === "dusk") S.sun = { x: 840, y: yh - 46, r: 36 };
  const dayTime = hour === "day";

  const clouds = [...lowClouds(S, 5), ...skyClouds(S, [[880, 500, 250, 110, 7, 21], [120, 560, 210, 90, 6, 22], [640, 330, 200, 90, 6, 23], [240, 250, 260, 110, 7, 24], [800, 160, 300, 130, 8, 25], [330, 40, 240, 100, 6, 26]])];
  paintSky(S, clouds, { cirrus: 30, stars: 1200 });
  birds(S, { n: 18, box: [S.sx(0.3), S.sy(0.3), S.sx(0.95), yh - 170], seed: 1 });

  // Far land at the horizon: the point of Cap Ferret, with its lighthouse.
  cv.layer = 2;
  const land = P.land;
  P.land = E.pine;
  const cape = (x) => (9 + 7 * vnoise(x / 80, 1, 3)) * sm(700, 840, x) * (1 - 0.7 * sm(1240, 1600, x)) + 2 * vnoise(x / 9, 2, 3);
  paintRidge(S, { h: cape, base: yh + 2, x0: 600, x1: S.x1, top: yh - 34, seed: 9, haze: 0.5, dab: [4, 9] });
  P.land = land;
  const [lx, ly] = [965, yh + 2 - cape(965)];
  cv.oilPastel(cv.line(lx, ly, lx, ly - 30, 0.2), dayTime ? P.glow : S.dark(P.glow, 0.35), 4.2, { cap: 0.2 });
  cv.oilPastel(cv.line(lx, ly - 30, lx, ly - 36, 0.1), P.hot, 4.4, { cap: 0.3 });
  cv.dot(lx, ly - 39, 2, dayTime ? P.ink : P.lamp, { grain: 0.2 });
  if (!dayTime) twinkle(S, [[lx, ly - 39, 3.4]], { seed: 2, keep: 2 });
  S.cut();

  // Sea. Only the right part shows: the forest and the dune cover the left part.
  const left = S.x0;
  S.x0 = 660;
  paintSea(S, { y1: yh + 390, glitterTo: yh + 230 });
  S.x0 = left;
  sailer(S, { y: yh + 13, L: 26, speed: 6, dir: 1, seed: 2 });
  sailer(S, { y: yh + 118, L: 56, speed: 10, dir: -1, seed: 5, body: P.hot });

  // Sandbanks of the Banc d'Arguin: pale shallow water, then the sand, then foam.
  cv.layer = 4;
  const banks = [[890, yh + 26, 150, 7], [1090, yh + 56, 210, 11], [1320, yh + 30, 190, 8], [1570, yh + 60, 200, 10], [1010, yh + 100, 110, 7], [1380, yh + 132, 170, 10]];
  for (const [bx, by, rx, ry] of banks) {
    if (bx - rx * 1.5 > S.x1) continue;
    const d = (x, y) => Math.hypot((x - bx) / rx, (y - by) / ry) + (vnoise(x / 26, y / 7, bx) - 0.5) * 0.5;
    cv.scumble([bx - rx * 1.5, by - ry * 3, bx + rx * 1.5, by + ry * 3.4], "softPastel", { angle: 0, jitter: 0.04, len: [14, 44], width: [2.4, 4.4], gap: 0.9, mask: (x, y) => sm(1.75, 1.05, d(x, y)) * 0.9, color: (x, y) => mix(S.seaAt(x, y), P.sea[P.sea.length - 1], 0.6), cj: 0.03 });
    cv.scumble([bx - rx * 1.1, by - ry * 1.4, bx + rx * 1.1, by + ry * 1.5], "oilPastel", { angle: 0, jitter: 0.03, len: [12, 40], width: [2.2, 4], gap: 0.5, lap: 0.7, mask: (x, y) => sm(1.02, 0.86, d(x, y)), color: (x, y) => ramp(E.lit, 0.55 + 0.45 * sm(0.5, -0.9, (y - by) / ry) + R.gauss() * 0.06), cj: 0.02 });
    cv.scumble([bx - rx * 1.1, by - ry * 0.2, bx + rx * 1.1, by + ry * 1.7], "softPastel", { angle: 0, jitter: 0.03, len: [8, 26], width: [1.6, 2.8], gap: 1.6, mask: (x, y) => sm(0.3, 0.14, Math.abs(d(x, y) - 0.96)) * sm(0, 0.4, (y - by) / ry), color: mix(ramp(E.shade, 0.5), ramp(E.lit, 0.3), 0.5), cj: 0.03 });
    cv.scumble([bx - rx * 1.2, by - ry * 2, bx + rx * 1.2, by + ry * 0.4], "oilPastel", { angle: 0, jitter: 0.2, len: [4, 12], width: [1.6, 3], gap: 3.2, mask: (x, y) => sm(0.22, 0.05, Math.abs(d(x, y) - 1.08)) * sm(0.2, -0.5, (y - by) / ry), color: S.lit(P.glow, 0.5) });
  }
  // Boats at anchor near the banks.
  const fleet = [[800, yh + 16, 14, 0], [945, yh + 50, 19, 1], [1160, yh + 30, 15, 2], [1230, yh + 92, 32, 3], [930, yh + 84, 28, 4], [1450, yh + 84, 28, 5], [1160, yh + 150, 50, 6], [1560, yh + 170, 58, 3], [1010, yh + 140, 40, 7]];
  fleet.forEach(([x, y, L, i]) => {
    if (x - 60 > S.x1 || y > top(x) - 6) return;
    const body = [P.glow, P.hot, P.wall[2], P.sea[1]][i % 4];
    if (i % 3 === 1) yola(S, { x, y, L: L * 1.2, body, trim: P.glow, dir: i % 2 ? 1 : -1 });
    else sloop(S, { x, y, L, body: dayTime ? body : S.dark(body, 0.35) });
  });
  S.cut();

  // Pine forest below the dune, to the horizon. Marks are small far away and large near the viewer.
  const forestTop = (x) => yh - 13 - 8 * vnoise(x / 70, 2, 5) - 3 * vnoise(x / 9, 3, 5);
  const inForest = (x, y) => (y > forestTop(x) && y < top(x) + 26 ? 1 : 0);
  const forestAt = (x, y) => {
    const d = clamp((y - yh + 12) / 470);
    const crowns = fbm(x / (15 + 70 * d) + y / 400, y / (7 + 34 * d), 31, 3);
    const c = ramp(E.pine, 0.66 - 0.36 * d ** 0.7 + (crowns - 0.5) * 1.1 + R.gauss() * 0.06);
    return mix(c, S.skyAt(x, yh - 12), 0.5 * (1 - d) ** 2.4);
  };
  const fx1 = 360;
  for (let b = 0; b < 6; b++) {
    const ya = yh - 26 + 560 * (b / 6) ** 1.5;
    const yb = yh - 26 + 560 * ((b + 1) / 6) ** 1.5;
    if (b === 5 && S.bottom > yb) continue;
    const dm = (b + 0.5) / 6;
    const box = [S.x0, ya, fx1, yb + 4];
    cv.scumble(box, "block", { angle: 0.1, jitter: 0.3, len: [10 + 36 * dm, 22 + 64 * dm], width: [6 + 10 * dm, 10 + 15 * dm], gap: 0.5, lap: 0.6, mask: inForest, color: forestAt, cj: 0.02 });
    // Round dabs for the crowns. Light dabs sit a little higher than dark dabs.
    cv.scumble(box, "softPastel", { angle: 0.05, jitter: 0.5, len: [5 + 13 * dm, 8 + 22 * dm], width: [4 + 6 * dm, 6 + 10 * dm], gap: 0.8, lap: 0.9, mask: inForest, color: forestAt, cj: 0.045 });
    cv.scumble(box, "softPastel", { angle: -0.1, jitter: 0.4, len: [4 + 10 * dm, 7 + 18 * dm], width: [3 + 3 * dm, 5 + 6 * dm], gap: 2.6, lap: 0.9, mask: inForest, color: (x, y) => mix(forestAt(x, y - 3 - 8 * dm), E.pine[4], 0.45), cj: 0.05 });
    // Dark gaps and trunks between the crowns.
    if (b > 2) cv.scumble(box, "pencil", { angle: 1.5, jitter: 0.12, len: [4 + 14 * dm, 8 + 26 * dm], width: [1.4, 2 + dm], gap: 9, mask: inForest, color: (x, y) => mix(forestAt(x, y), E.pine[0], 0.7), cj: 0.03 });
  }
  // Below the bands, the forest continues to the lower edge at the far left.
  const lowBox = [S.x0, yh - 26 + 560 * (5 / 6) ** 1.5, 120, S.bottom];
  if (S.bottom > lowBox[1] && S.x0 < 0) {
    cv.scumble(lowBox, "block", { angle: 0.1, jitter: 0.3, len: [44, 84], width: [15, 24], gap: 0.5, lap: 0.6, mask: inForest, color: forestAt, cj: 0.02 });
    cv.scumble(lowBox, "softPastel", { angle: 0.05, jitter: 0.5, len: [18, 30], width: [10, 16], gap: 0.8, lap: 0.9, mask: inForest, color: forestAt, cj: 0.045 });
    cv.scumble(lowBox, "softPastel", { angle: -0.1, jitter: 0.4, len: [14, 25], width: [6, 11], gap: 2.6, lap: 0.9, mask: inForest, color: (x, y) => mix(forestAt(x, y - 11), E.pine[4], 0.45), cj: 0.05 });
    cv.scumble(lowBox, "pencil", { angle: 1.5, jitter: 0.12, len: [18, 34], width: [1.6, 3], gap: 9, mask: inForest, color: (x, y) => mix(forestAt(x, y), E.pine[0], 0.7), cj: 0.03 });
  }
  // Single crowns that take the light, near the dune.
  const crowns = [];
  for (let i = 0; i < 110; i++) {
    const x = R.range(S.x0, 300);
    const y = R.range(yh + 40, Math.min(S.bottom, top(x) - 4));
    if (y > yh + 40) crowns.push([x, y]);
  }
  crowns.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of crowns) {
    const d = clamp((y - yh) / 470);
    const [rx, ry] = [(8 + 34 * d) * R.range(0.7, 1.2), (3 + 11 * d) * R.range(0.7, 1.2)];
    cv.hatch(ellipse(x, y, rx, ry, -0.06), "softPastel", ramp(E.pine, 0.2 + 0.1 * R()), { angle: 0.1, width: 2.4 + 5 * d, spacing: 1.8 + 3 * d, maxLen: rx * 1.6, press: 1.05, cj: 0.04 });
    cv.hatch(ellipse(x + rx * 0.16, y - ry * 0.4, rx * 0.74, ry * 0.5, -0.1), "softPastel", ramp(E.pine, 0.66 + 0.26 * R()), { angle: -0.2, width: 2 + 4 * d, spacing: 2 + 3.4 * d, maxLen: rx, press: 0.9, cj: 0.05 });
    if (d > 0.3) cv.pencil(cv.line(x + R.range(-2, 2), y + ry * 0.7, x + R.range(-5, 5), y + ry * 0.7 + (10 + 46 * d) * R.range(0.6, 1), 0.6), mix(E.pine[0], E.shade[1], 0.3), 1.3 + 2 * d);
  }
  S.cut();

  // The dune. Right of the ridge the sand takes the light. Left of the ridge is the steep face in shadow.
  // The sand goes into the forest in tongues.
  const edge = (x) => top(x) + 3 * (vnoise(x / 18, 1, 7) - 0.5) + (x < 330 ? 34 * (vnoise(x / 46, 4, 7) - 0.5) * sm(330, 200, x) : 0);
  const inDune = (x, y) => (y > edge(x) ? 1 : 0);
  const lit = (x, y) => sm(-5, 5, x - crestX(y));
  const duneAt = (x, y) => {
    const dc = x - crestX(y);
    const z = near(y);
    const k = lit(x, y);
    const humps = fbm(x / (110 + 260 * z), y / (36 + 110 * z), 12, 3) - 0.5;
    // Low side crests: thin curved bands of soft shadow.
    const band = sm(0.8, 0.97, 1 - Math.abs(2 * fbm(x / 300 + 3, y / 150, 19, 2) - 1)) * sm(40, 160, dc);
    const shore = x > 740 ? sm(top(x) + 46, top(x) + 4, y) : 0;
    const bright = 0.6 + 0.3 * sm(120, 0, dc) - 0.16 * sm(80, 760, dc) + humps * 0.8 - 0.3 * shore;
    const dim = 0.02 + 0.6 * sm(0, -220 - 160 * z, dc) + (fbm(x / 80, y / 130, 13, 2) - 0.5) * 0.4;
    // Hollows on the lit side get a soft shadow. The shadow face gets some warm light from the sand, low down.
    const sun = mix(ramp(E.lit, bright), ramp(E.shade, 0.7), Math.min(0.75, 0.66 * sm(0, -0.24, humps) + 0.45 * band));
    const c = mix(mix(ramp(E.shade, dim), E.lit[0], 0.2 * sm(-60, -320, dc)), sun, k);
    return shore > 0 ? mix(c, S.skyAt(x, yh - 80), shore * 0.3) : c;
  };
  const box = [S.x0, 596, S.x1, S.bottom];
  // Long marks stay away from the upper edge. Short marks along the edge fill the rim.
  const deep = (x, y) => (y > edge(x) + 26 ? 1 : 0);
  const along = (x) => Math.atan2(top(x + 20) - top(x - 20), 40);
  cv.scumble(box, "block", { angle: (x, y) => (lit(x, y) > 0.5 ? 0.3 : -1.02), jitter: 0.08, len: [60, 150], width: [15, 26], gap: 0.5, lap: 0.55, mask: (x, y) => deep(x, y) * (lit(x, y) > 0.5 || y > edge(x) + 70 ? 1 : 0) * (Math.abs(x - crestX(y)) > 52 ? 1 : 0), color: duneAt, cj: 0.015 });
  cv.scumble(box, "block", { angle: (x) => along(x), jitter: 0.1, len: [26, 60], width: [12, 20], gap: 0.45, lap: 0.6, mask: (x, y) => inDune(x, y + 6) * (lit(x, y) > 0.5 ? 1 - deep(x, y) : sm(100, 60, y - edge(x))), color: duneAt, cj: 0.015 });
  // Next to the ridge, short marks go along it. Then no long mark goes across the sharp edge.
  const beside = (x, y) => inDune(x, y) * sm(70, 44, Math.abs(x - crestX(y)));
  const alongRidge = (x, y) => Math.atan2(16, crestX(y + 8) - crestX(y - 8));
  cv.scumble(box, "block", { angle: alongRidge, jitter: 0.06, len: [22, 46], width: [11, 18], gap: 0.42, lap: 0.6, mask: beside, color: duneAt, cj: 0.015 });
  cv.scumble(box, "softPastel", { angle: alongRidge, jitter: 0.1, len: [16, 40], width: [3, 5.5], gap: 1.2, lap: 0.8, mask: beside, color: duneAt, cj: 0.035 });
  // Lit side: marks follow the slope. Shadow side: steep marks down the face.
  cv.scumble(box, "softPastel", { angle: (x, y) => 0.14 + 0.5 * (fbm(x / 240, y / 150, 15, 2) - 0.5), jitter: 0.1, len: [30, 96], width: [3, 6], gap: 1.35, lap: 0.8, mask: (x, y) => inDune(x, y) * (x - crestX(y) > 40 ? 1 : 0), color: (x, y) => duneAt(x, y + R.gauss() * 16), cj: 0.035 });
  cv.scumble(box, "softPastel", { angle: -1.04, jitter: 0.07, len: [30, 90], width: [3, 6], gap: 1.25, lap: 0.8, mask: (x, y) => (y > edge(x) + 44 && crestX(y) - x > 26 ? 1 : 0), color: (x, y) => duneAt(Math.min(x, crestX(y) - 8) + R.gauss() * 10, y), cj: 0.035 });
  cv.scumble(box, "softPastel", { angle: -1.04, jitter: 0.1, len: [12, 30], width: [3, 5.5], gap: 1.1, lap: 0.8, mask: (x, y) => inDune(x, y - 8) * (y < edge(x) + 50 ? 1 : 0) * (1 - lit(x, y)), color: duneAt, cj: 0.035 });
  cv.scumble(box, "softPastel", { angle: -0.72, len: [26, 60], width: [3, 5], gap: 3.4, press: 0.85, mask: (x, y) => (y > edge(x) + 24 && Math.abs(x - crestX(y)) > 30 ? 1 : 0), color: (x, y) => S.lit(duneAt(x, y), 0.16), cj: 0.04 });
  // Wind ripples: thin wavy lines on the lit sand, close together near the viewer.
  cv.scumble(box, "pencil", {
    angle: (x, y) => 0.2 + 0.34 * Math.sin(y / 46 + 3 * fbm(x / 200, y / 200, 17, 2)), jitter: 0.06, wob: 2.4, len: [22, 80], width: [1.4, 2.6], gap: 4.6,
    mask: (x, y) => inDune(x, y) * lit(x, y) * (0.35 + 0.65 * near(y)),
    color: (x, y) => (R() < 0.55 ? mix(duneAt(x, y), ramp(E.shade, 0.6), 0.34) : S.lit(duneAt(x, y), 0.4)), cj: 0.03,
  });
  // The ridge: a bright edge on the lit side, a dark line on the shadow side.
  const crest = [];
  for (let y = 624; y < S.bottom; y += 14) crest.push([crestX(y), y]);
  for (let i = 0; i + 4 < crest.length; i += 3) {
    const part = crest.slice(i, i + 5);
    const z = near(part[2][1]);
    cv.softPastel(cv.wobble(part.map(([x, y]) => [x - 3 - 5 * z, y]), 1), ramp(E.shade, 0.04), 3 + 8 * z, { press: 1.05 });
    cv.oilPastel(cv.wobble(part.map(([x, y]) => [x + 3 + 4 * z, y]), 1), ramp(E.lit, 1), 2 + 5 * z, { press: 0.95 });
  }
  // Footprints: small dark marks in trails. One trail goes along the ridge.
  const prints = [];
  for (let k = 0; k < 9; k++) {
    // A trail starts on the ridge and goes down the lit side.
    let y = R.range(660, 1180);
    let x = crestX(y) + R.range(10, 30);
    const [dx, dy] = [R.range(0.5, 1), R.range(-0.1, 0.5)];
    for (let i = 0; i < 46 && inDune(x, y - 4); i++) {
      prints.push([x + R.range(-3, 3) * near(y), y]);
      const stride = 6 + 22 * near(y);
      x += dx * stride + (i % 2 ? 3 : -3) * near(y);
      y += dy * stride * 0.5;
    }
  }
  for (let y = 640; y < S.bottom; y += 4 + 20 * near(y)) prints.push([crestX(y) + (10 + 20 * near(y)) * (1 + 0.4 * Math.sin(y * 1.7)), y]);
  for (const [x, y] of prints) {
    const z = near(y);
    cv.softPastel([[x, y - 1 - 3.5 * z], [x + 1.5 * z, y + 1 + 3.5 * z]], mix(duneAt(x, y), ramp(E.shade, 0.3), 0.5), 1.6 + 5 * z, { press: 0.95 });
    if (z > 0.45) cv.pencil([[x - 3 * z, y + 5 * z], [x + 4.5 * z, y + 5.5 * z]], S.lit(duneAt(x, y), 0.5), 1 + 1.4 * z, { press: 0.8 });
  }
  // Foam and wet sand where the dune meets the sea.
  const beach = [];
  for (let x = 752; x < S.x1 + 20; x += 22) beach.push([x, top(x)]);
  for (const [off, w, k] of [[-9, 2.6, 0.6], [-3, 4.4, 1]]) cv.oilPastel(cv.wobble(beach.map(([x, y]) => [x, y + off + 3 * vnoise(x / 40, off, 6)]), 1.6), S.lit(P.glow, 0.5), w, { press: k, span: 0.4, mod: (x) => 0.35 + 1.1 * vnoise(x / 30, off * 0.3, 8) });
  S.cut();

  // Wood stairs up the shadow face, from the forest to the ridge.
  cv.layer = 5;
  const [sa, sb] = [[205, top(205) + 22], [crestX(812) - 4, 812]];
  const wood = dayTime ? P.wood[2] : P.wood[1];
  const step = (t, off) => [sa[0] + (sb[0] - sa[0]) * t, sa[1] + (sb[1] - sa[1]) * t + off - 5 * Math.sin(Math.PI * t)];
  const rail = (off) => Array.from({ length: 13 }, (_, i) => step(i / 12, off));
  for (let i = 0; i <= 46; i++) cv.oilPastel([step(i / 46, 9), step(i / 46 + 0.003, -1)], i % 2 ? S.lit(wood, 0.4) : S.dark(wood, 0.45), 3, { press: 0.95, cap: 0.3 });
  for (let i = 0; i <= 9; i++) cv.pencil([step(i / 9, 10), step(i / 9, -16)], P.wood[0], 2.2);
  cv.pencil(cv.wobble(rail(-15), 0.5), S.lit(wood, 0.3), 2.2);
  cv.pencil(cv.wobble(rail(10), 0.5), P.wood[0], 2);

  // Very small people: on the stairs, along the ridge and on the summit.
  const cloth = [P.hot, P.glow, P.sea[1], P.lamp, P.wall[2], P.cloud[1], P.roof[0]];
  const people = [];
  for (const t of [0.18, 0.3, 0.52, 0.58, 0.83]) people.push([...step(t, 2), 0]);
  for (const y of [626, 629, 634, 642, 656, 676, 698, 734, 776, 838, 846, 905, 990]) people.push([crestX(y) + R.range(2, 12) * (1 + 3 * near(y)), y + R.range(-2, 2), 1]);
  for (const [dx, dy] of [[60, 640], [72, 643], [120, 668], [200, 742], [214, 746], [190, 806], [300, 838], [316, 843], [150, 905], [420, 930], [436, 936], [520, 968], [260, 1010], [640, 1010], [655, 1018], [470, 1090], [760, 1068]]) people.push([crestX(dy) + dx, dy, 1]);
  people.sort((a, b) => a[1] - b[1]);
  for (const [x, y, onLit] of people) {
    const h = 8 + 30 * near(y);
    const c = R.pick(cloth);
    figure(S, x, y, h, dayTime ? c : S.dark(c, 0.4), mix(duneAt(x, y), ramp(E.shade, 0.2), onLit ? 0.6 : 0.3));
  }
  // Two wings on the sand near the summit.
  for (const [x, y, c] of [[560, 690, P.hot], [640, 742, P.sea[2]]]) {
    cv.softPastel(cv.line(x - 10, y + 3, x + 12, y + 4, 0.4), mix(duneAt(x, y), ramp(E.shade, 0.3), 0.5), 3);
    cv.oilPastel(spline([[x - 12, y + 1], [x, y - 3], [x + 13, y]], 5), dayTime ? c : S.dark(c, 0.4), 3.2, { taper: 0.5 });
  }

  // Chestnut fence and beach grass near the viewer, at the right edge.
  const fx = cv.x1 - 20;
  const fence = (t) => [fx - 330 * t, 1322 - 300 * t ** 0.8];
  const posts = [];
  for (let t = 0; t <= 1.001; t += 0.022 + 0.05 * (1 - t) ** 2) posts.push(fence(Math.min(1, t)));
  posts.forEach(([x, y], i) => {
    const z = near(y);
    const hgt = 62 * z * R.range(0.82, 1.1);
    cv.pencil(cv.line(x + R.range(-3, 3) * z, y, x + R.range(-4, 4) * z, y - hgt, 0.5), i % 3 ? P.wood[0] : S.lit(P.wood[1], 0.1), 1.4 + 2.4 * z, { press: 1 });
  });
  for (const k of [0.32, 0.7]) cv.pencil(cv.wobble(posts.map(([x, y]) => [x, y - 62 * near(y) * k]), 0.8), P.ink, 1.3, { press: 0.75 });
  const tufts = [[fx - 70, 1300, 1], [fx - 200, 1262, 0.9], [fx - 20, 1196, 0.8], [fx - 150, 1160, 0.6], [cv.x0 + 380, 1318, 0.9], [crestX(1180) + 150, 1300, 0.8]];
  for (const [x, y, s] of tufts) {
    for (let i = 0; i < 46; i++) {
      const bx = x + R.gauss() * 34 * s;
      const a = -1.57 + R.gauss() * 0.5;
      const l = R.range(26, 74) * s;
      cv.pencil(spline([[bx, y + R.range(-6, 8)], [bx + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6], [bx + Math.cos(a) * l + R.range(-10, 10), y + Math.sin(a) * l + l * 0.12]], 5), R() < 0.6 ? ramp(E.pine, R.range(0.25, 0.95)) : ramp(E.lit, R.range(0.1, 0.9)), R.range(1.4, 2.8) * s, { taper: 0.8 });
    }
  }
  // Tall pines at the left edge, in front of the forest.
  // A narrow window gets one small pine: the stairs and the ridge must show.
  if (cv.x1 - cv.x0 > 1150) {
    pine(S, E, cv.x0 + 64, S.bottom, S.bottom - yh + 120, 46);
    pine(S, E, cv.x0 + 178, S.bottom, S.bottom - yh - 30, -30);
  } else pine(S, E, cv.x0 + 44, S.bottom, S.bottom - yh - 70, 30, 380);
  S.cut();

  // Lamps at the edge of the forest. They are on after sunset.
  if (!dayTime) {
    const lamps = [];
    for (const x of [-520, -410, -290, -186, -96, -20, 52, 118, 176, 226]) {
      if (x < S.x0) continue;
      const y = top(x) - R.range(4, 26);
      lamps.push([x, y, 3.2]);
      for (let i = 0; i < 6; i++) cv.softPastel(cv.line(x - R.range(6, 22), y + R.range(-9, 9), x + R.range(6, 22), y + R.range(-9, 9), 0.4), P.lamp, 2.2, { press: 0.5 });
      cv.dot(x, y, 2.6, P.lamp, { grain: 0.2 });
    }
    for (let i = 0; i < 16; i++) {
      const x = R.range(S.x0, 290);
      const y = R.range(yh + 6, Math.min(top(x) - 30, yh + 260));
      if (y > yh + 6) lamps.push([x, y, 1.2 + 1.6 * clamp((y - yh) / 300)]);
    }
    twinkle(S, lamps, { seed: 3 });
  }
  S.cut();

  // Paragliders above the ridge. They go from side to side in the wind off the sea.
  const G = rng(606 * 7);
  const q = clamp((yh - cv.y0) / 380, 0.85, 1.7);
  const wings = [P.hot, P.lamp, P.sea[2], P.wall[2], P.glow, P.roof[0], P.sea[3]];
  const spots = [[300, 110, 54], [520, 250, 78], [690, 120, 60], [820, 290, 44], [170, 230, 40], [960, 200, 36], [600, 340, 30]];
  // A tall sky gets more wings, higher up.
  if (q > 1.3) spots.push([380, 430, 66], [760, 520, 48], [210, 600, 34]);
  const fliers = spots.map(([x, up, s], i) => ({
    x, y: yh - up * q, s, rx: G.range(60, 150), ry: G.range(10, 30), w: G.range(0.12, 0.22) * (i % 2 ? 1 : -1), ph: G.range(0, 6.28),
    color: dayTime ? wings[i % wings.length] : S.dark(wings[i % wings.length], hour === "night" ? 0.45 : 0.2), trim: dayTime ? P.glow : P.cloud[3],
  }));
  S.sprites.push({
    seed: 61,
    keep: 4,
    draw(ov, t) {
      for (const f of fliers) {
        const a = f.ph + t * f.w;
        glider(ov, P, f.x + Math.sin(a) * f.rx, f.y + Math.sin(a * 2) * f.ry + Math.sin(t * 0.9 + f.ph) * 3, f.s, Math.cos(a) * 0.26, f.color, f.trim);
      }
    },
  });
  return S;
}

export default { id: "pilat", name: "Dune du Pilat", alt: "Pastel drawing of the Dune du Pilat: a high sand ridge between a pine forest and the ocean, with paragliders above it.", frame: { top: 390, bottom: 1333 }, draw };
