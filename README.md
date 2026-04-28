# fetchstream — monorepo

**Docs:** [eklavya-raj.github.io/fetchstream](https://eklavya-raj.github.io/fetchstream/)  
**React demo:** [fetchstream.vercel.app](https://fetchstream.vercel.app/)

This repository is a [pnpm workspace](https://pnpm.io/workspaces) containing
the **`fetchstream`** library and its runnable examples.

```
fetchstream/
├── packages/
│   └── fetchstream/                # The library itself ── [docs](https://eklavya-raj.github.io/fetchstream/)
├── examples/
│   ├── node/                       # Node CLI demos (server + client)
│   ├── browser/                    # Static HTML demos (no bundler)
│   └── react/                      # Next.js + React 19 benchmark demo
├── docs/                           # VitePress documentation site
├── package.json                    # Root scripts
└── pnpm-workspace.yaml
```

## Getting started

> Requires **Node ≥ 18** and **pnpm ≥ 8**.

```bash
pnpm install
```

That single command installs the dev tooling (Vite, React, etc.) and links
each example's `"fetchstream": "workspace:*"` dependency to the in-repo
source — no publishing, no symlinking by hand.

## Common scripts (run from the repo root)

| Command             | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `pnpm test`         | Run the library test suite (`packages/fetchstream`)           |
| `pnpm bench`        | Run the streaming-vs-`JSON.parse` benchmark                   |
| `pnpm dev:react`    | Start the Next.js React demo on <http://localhost:3000>       |
| `pnpm build:react`  | Production build of the React demo                            |
| `pnpm docs:dev`     | Start the VitePress docs locally on <http://localhost:5173>   |
| `pnpm docs:build`   | Build the static documentation site                           |
| `pnpm docs:preview` | Preview the built docs site                                   |
| `pnpm demo:server`  | Start the slow Node JSON streamer (used by the browser demos) |
| `pnpm demo:node`    | Run the Node consumer example (talks to `demo:server`)        |
| `pnpm demo:live`    | Run the Node live-mirror example                              |

You can also drop into any workspace and use its scripts directly:

```bash
pnpm -F fetchstream test
pnpm -F react dev
pnpm -F @fetchstream/node-examples server
```

## Packages

| Workspace                    | Path                   | Description                                       |
| ---------------------------- | ---------------------- | ------------------------------------------------- |
| `fetchstream`                | `packages/fetchstream` | The streaming JSON parser library                 |
| `@fetchstream/node-examples` | `examples/node`        | `server.mjs`, `node-example.mjs`, `live-node.mjs` |
| `react`                      | `examples/react`       | Next.js + React 19 benchmark demo                 |

The full documentation (guides, API reference, examples) is deployed at
[eklavya-raj.github.io/fetchstream](https://eklavya-raj.github.io/fetchstream/).
For a quick overview, see [`packages/fetchstream/README.md`](packages/fetchstream/README.md).
