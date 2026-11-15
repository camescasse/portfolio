// The places. Each place is painted at three hours: day, dusk and night.
import bayahibe from "./bayahibe.mjs";
import montjuic from "./montjuic.mjs";
import pilat from "./pilat.mjs";
import rome from "./rome.mjs";

export { HOURS, PAPER } from "../kit.mjs";
export const SCENES = Object.fromEntries([pilat, montjuic, bayahibe, rome].map((scene) => [scene.id, scene]));
