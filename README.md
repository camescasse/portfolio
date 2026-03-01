# camescasse.dev: portfolio

Personal portfolio and blog built with Astro.

The site keeps a minimal, terminal-inspired style with a static output, but content is now markdown-driven so it is easier to maintain and expand.

Live site: https://camescasse.dev/

## Stack

- Astro (static output)
- Berkeley Mono (self-hosted font)
- Markdown content collections (blog, about, projects, work experience)
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

- Blog posts: `src/content/blog/*.md`
- About: `src/content/about/about.md`
- Projects: `src/content/projects/*.md`
- Work experience: `src/content/experience/*.md`

## Deploy (Coolify / Dockerfile)

This repo includes a multi-stage `Dockerfile` that builds the Astro site and serves `dist/` with Nginx.

- Dockerfile: `Dockerfile`
- Nginx config: `nginx.conf`
- Container port: `80`
