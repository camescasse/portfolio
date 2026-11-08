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

## Deploy (Coolify / Dockerfile)

This repo includes a multi-stage `Dockerfile` that builds the Astro site and serves `dist/` with Nginx.

- Dockerfile: `Dockerfile`
- Nginx config: `nginx.conf`
- Container port: `80`
