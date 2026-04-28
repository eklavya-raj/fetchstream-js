# fetchstream-js documentation

VitePress site for the [`fetchstream-js`](https://github.com/eklavya-raj/fetchstream-js/tree/main/packages/fetchstream-js) library.

## Local development

From the monorepo root:

```bash
pnpm install
pnpm run docs:dev      # http://localhost:5173
```

## Production build

```bash
pnpm run docs:build    # outputs to docs/.vitepress/dist
pnpm run docs:preview  # serves the built site locally
```

## Structure

```
docs/
├── .vitepress/
│   └── config.ts          # site config: nav, sidebar, theme
├── public/                # static assets (logo, favicon)
├── index.md               # landing page (home layout)
├── guide/                 # narrative docs
├── api/                   # API reference
└── examples/              # walkthroughs of repo examples
```

## Deploying

VitePress emits a static site to `docs/.vitepress/dist`. Drop it into:

- **GitHub Pages** — set Pages source to the `gh-pages` branch and use `peaceiris/actions-gh-pages` to publish on push
- **Vercel / Netlify** — point the build command at `pnpm run docs:build` and the output dir at `docs/.vitepress/dist`
- **Cloudflare Pages** — same as above
