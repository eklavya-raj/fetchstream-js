# fetchstream-js — monorepo

> **A drop-in replacement for `fetch()` and `axios.get()` for JSON endpoints.**
> Your UI sees data the moment the first bytes land on the wire — not after the full response finishes downloading.

**Docs:** [eklavya-raj.github.io/fetchstream-js](https://eklavya-raj.github.io/fetchstream-js/)  
**npm:** [npmjs.com/package/fetchstream-js](https://www.npmjs.com/package/fetchstream-js)  
**React demo:** [fetchstream-js.vercel.app](https://fetchstream-js.vercel.app/)

```js
// ❌ fetch / axios: blocks until the full body downloads
const data = await fetch("/api/users").then((r) => r.json()); // ⏳ 3 s
render(data);

// ✅ fetchstream-js: renders as bytes arrive
import { fetchStream } from "fetchstream-js";
fetchStream("/api/users").live((root) => render(root), { throttle: "raf" });
//                                                          first row in ~120 ms
```

This repository is a [pnpm workspace](https://pnpm.io/workspaces) containing
the **`fetchstream-js`** library and its runnable examples.

```
fetchstream-js/
├── packages/
│   └── fetchstream-js/                # The library itself ── [docs](https://eklavya-raj.github.io/fetchstream-js/)
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
each example's `"fetchstream-js": "workspace:*"` dependency to the in-repo
source — no publishing, no symlinking by hand.

## Common scripts (run from the repo root)

| Command             | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `pnpm test`         | Run the library test suite (`packages/fetchstream-js`)        |
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
pnpm -F fetchstream-js test
pnpm -F react dev
pnpm -F @fetchstream-js/node-examples server
```

## Packages

| Workspace                       | Path                      | Description                                       |
| ------------------------------- | ------------------------- | ------------------------------------------------- |
| `fetchstream-js`                | `packages/fetchstream-js` | The streaming JSON parser library                 |
| `@fetchstream-js/node-examples` | `examples/node`           | `server.mjs`, `node-example.mjs`, `live-node.mjs` |
| `react`                         | `examples/react`          | Next.js + React 19 benchmark demo                 |

The full documentation (guides, API reference, examples) is deployed at
[eklavya-raj.github.io/fetchstream-js](https://eklavya-raj.github.io/fetchstream-js/).
For a quick overview, see [`packages/fetchstream-js/README.md`](packages/fetchstream-js/README.md).
