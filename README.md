# camescas.se: portfolio

Personal portfolio and blog built with Astro.

A static site with a set of numbered sheets: letter, work graph, projects, skills, writing, and contact.

Live site: https://camescas.se/

## Stack

- Astro (static output)
- Hanken Grotesk (Fontsource) and TX-02 (self-hosted, for labels and the nav)
- Markdown content collection for the blog
- pnpm
- Docker + Nginx (for container deploys)

## Local development

```sh
pnpm install
pnpm dev
```

Build for production:

```sh
pnpm build
```

## Content structure

- Profile, work, projects, skills, and links: `src/data/cv.ts`
- Blog posts: `src/content/blog/*.md`
- CV PDF: `public/cv/eric-camescasse-cv.pdf`. Make it with `build-cv.py` from the resume JSON.

## Plates

The home page is a card above a pastel picture. The browser paints the picture stroke by stroke.
A visitor can put the card away, and can change the place and the hour.
The header bar stays at the top of the window. With the card away, a small name card stays there and the page does not scroll.

- Paint engine and dry art tools: `scripts/plates/engine.mjs`
- Shared scene parts (sky, sea, boats, birds): `scripts/plates/kit.mjs`
- One file for each place: `scripts/plates/scenes/`
- Order and time of the strokes: `scripts/plates/timeline.mjs`
- Web Worker that paints on the page: `src/scripts/scene-worker.js`
- Canvas, labels and card controls: `src/components/Scene.astro`

A new place starts with broad wash strokes. Then the new picture follows the wash.
A new hour paints the new tones over the old picture.
Small things move on a clear layer above the picture. The water gets new wave marks all the time.
With reduced motion, the page shows the complete picture and nothing moves.

Render a place to PNG files for review:

```sh
pnpm plates rome all --size 1440x900 --sheet
pnpm plates rome night --frames --from rome:day
```

The script writes to `art/plates/`. Git ignores `art/`.

## Deploy (Coolify / Dockerfile)

This repo includes a multi-stage `Dockerfile` that builds the Astro site and serves `dist/` with Nginx.

- Dockerfile: `Dockerfile`
- Nginx config: `nginx.conf`
- Container port: `80`
