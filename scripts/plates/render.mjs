// Render the plates to PNG files in art/plates. The page paints the plates itself: these files are for review.
// Stills:  node scripts/plates/render.mjs [place|all] [hour|all] [--size 1440x900] [--sheet] [--live 30]
// Frames:  node scripts/plates/render.mjs <place> <hour> --frames [--from place:hour] [--size 720x450]
//   --frames makes one sheet of ten frames of the draw-in. --from gives the picture before the change.
//   --live N paints N seconds of moving water after the plate is complete.
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Canvas, fitView, rng } from "./engine.mjs";
import { HOURS, PAPER } from "./kit.mjs";
import { drawSprites, runLive, transition } from "./timeline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const valued = ["--size", "--from", "--live", "--dur"];
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : valued.includes(name) ? args[i + 1] : true;
};
const [placeArg = "all", hourArg = "all"] = args.filter((a, i) => !a.startsWith("--") && !valued.includes(args[i - 1]));
// Each place is loaded by name. A place with an error does not stop the other places.
const names = readdirSync(join(root, "scripts/plates/scenes")).filter((f) => f !== "index.mjs").map((f) => f.replace(".mjs", ""));
const places = placeArg === "all" ? names : placeArg.split(",");
const SCENES = {};
for (const id of new Set([...places, ...(flag("--from") ? [flag("--from").split(":")[0]] : [])])) SCENES[id] = (await import(`./scenes/${id}.mjs`)).default;
const hours = hourArg === "all" ? HOURS : hourArg.split(",");
const [W, H] = (flag("--size") ?? "1440x900").split("x").map(Number);
const outDir = join(root, "art/plates");
mkdirSync(outDir, { recursive: true });

const make = (place, hour) => {
  const cv = new Canvas(W, H, { paper: PAPER[hour], view: fitView(SCENES[place].frame, W, H) });
  return { cv, ov: new Canvas(W, H, { under: cv, view: fitView(SCENES[place].frame, W, H) }) };
};
const image = (cv, ov) => sharp(Buffer.from(cv.pixels(0, 0, W, H, 3, rng(77), ov).buffer), { raw: { width: W, height: H, channels: 3 } });

async function sheet(tiles, columns, out) {
  const tw = Math.round(W > H ? 640 : 400);
  const th = Math.round((tw * H) / W);
  const small = await Promise.all(tiles.map((tile) => (typeof tile === "string" ? sharp(tile) : tile).resize(tw, th).png().toBuffer()));
  await sharp({ create: { width: tw * columns, height: th * Math.ceil(small.length / columns), channels: 3, background: "#888" } })
    .composite(small.map((input, i) => ({ input, left: (i % columns) * tw, top: Math.floor(i / columns) * th })))
    .png()
    .toFile(out);
  console.log(out);
}

if (flag("--frames")) {
  const [place, hour] = [places[0], hours[0]];
  const from = flag("--from")?.split(":");
  const { cv, ov } = make(place, hour);
  if (from) {
    // The old picture. It uses the view of the new place: the page keeps one canvas.
    cv.setView(fitView(SCENES[from[0]].frame, W, H));
    SCENES[from[0]].draw(cv, from[1]);
    cv.setView(fitView(SCENES[place].frame, W, H));
  }
  const kind = from && from[0] === place ? "tone" : "coat";
  const dur = Number(flag("--dur") ?? (kind === "tone" ? 5 : 7.5));
  const t0 = Date.now();
  const { S, player } = transition(cv, SCENES[place], hour, { kind, dur, turn: 0 });
  console.log(`${player.items.length} marks, timeline ${Date.now() - t0} ms, last mark at ${player.items.at(-1).T.toFixed(2)} s`);
  const tiles = [];
  const n = 10;
  for (let f = 1; f <= n; f++) {
    while (player.t < (dur * f) / n - 1e-6) player.step(1 / 30);
    if (f === n) {
      player.finish();
      drawSprites(ov, S, 3);
    }
    tiles.push(image(cv, ov));
  }
  await sheet(tiles, 5, join(outDir, `frames-${place}-${hour}-${kind}.png`));
} else {
  const done = [];
  for (const place of places) {
    for (const hour of hours) {
      const t0 = Date.now();
      const { cv, ov } = make(place, hour);
      const S = SCENES[place].draw(cv, hour);
      const seconds = Number(flag("--live") ?? 0);
      for (let t = 0; t < seconds; t += 1 / 30) runLive(S, t, 1 / 30);
      drawSprites(ov, S, 3 + seconds);
      const png = join(outDir, `${place}-${hour}-${W}x${H}.png`);
      await image(cv, ov).png({ compressionLevel: 8 }).toFile(png);
      done.push(png);
      console.log(`${png}: ${cv.count} strokes, ${S.sprites.length} sprites, ${(cv.bare() * 100).toFixed(0)}% bare paper, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
  }
  // Contact sheets for review: one row for each place.
  if (flag("--sheet")) for (const place of places) await sheet(done.filter((file) => file.includes(`/${place}-`)), hours.length, join(outDir, `sheet-${place}-${W}x${H}.png`));
}
