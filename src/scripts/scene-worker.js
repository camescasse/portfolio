// The picture behind the page. The worker paints it stroke by stroke on the canvas of the page.
// It uses the same engine, scenes and timeline as scripts/plates/render.mjs.
import { Canvas, fitView } from "../../scripts/plates/engine.mjs";
import { PAPER, SCENES } from "../../scripts/plates/scenes/index.mjs";
import { drawSprites, runLive, transition } from "../../scripts/plates/timeline.mjs";

const tick = self.requestAnimationFrame ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);

let ctx = null;
let cv = null;
let ov = null;
let still = false;
let S = null;
let player = null;
let shown = null;
let next = null;
let turn = 0;
let clock = 0;
let last = 0;
let lastLive = 0;
let running = false;

// Copy the changed tiles to the page.
function flush() {
  cv.flush((x, y, w, h) => ctx.putImageData(new ImageData(cv.pixels(x, y, w, h, 4, null, ov), w, h), x, y), ov);
}

function resize(width, height) {
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  cv = new Canvas(width, height, { paper: PAPER[(next ?? shown)?.hour ?? "day"] });
  ov = new Canvas(width, height, { under: cv });
  // The paper is empty again: the picture needs a full coat.
  if (shown && !next) next = { ...shown, dur: 2 };
  shown = null;
  S = null;
  player = null;
  cv.flag(0, 0, width, height);
}

function begin() {
  const want = next;
  if (!want) return;
  next = null;
  const scene = SCENES[want.place];
  // A new place gets a wash and a full coat. A new hour of the same place gets tone layers.
  const kind = shown && shown.place === want.place ? "tone" : "coat";
  const view = fitView(scene.frame, cv.W, cv.H);
  cv.setView(view);
  ov.setView(view);
  ov.wipe();
  ({ S, player } = transition(cv, scene, want.hour, { kind, dur: still ? 0 : want.dur, turn: turn++ }));
  shown = want;
  if (still) {
    player.finish();
    drawSprites(ov, S, 3);
  }
  flush();
  postMessage({ type: "start" });
  last = performance.now();
  if (!running && !still) {
    running = true;
    tick(frame);
  }
}

function frame(now) {
  tick(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  if (player && !player.done) {
    last = now;
    player.step(dt, 11);
    flush();
  } else if (S && now - lastLive >= 40) {
    // The picture is complete. Now the water and the birds move, at 25 frames each second.
    const step = Math.min(0.1, (now - lastLive) / 1000);
    last = lastLive = now;
    clock += step;
    runLive(S, clock, step);
    drawSprites(ov, S, clock);
    flush();
  }
}

self.onmessage = ({ data }) => {
  if (data.canvas) {
    ctx = data.canvas.getContext("2d");
    still = data.still;
  }
  if (data.size) resize(...data.size);
  if (data.place) {
    // Many fast requests become one job.
    const idle = !next;
    next = { place: data.place, hour: data.hour, dur: data.dur };
    if (idle) setTimeout(begin, 0);
  } else if (data.size && next) setTimeout(begin, 0);
};
