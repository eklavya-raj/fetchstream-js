# fetchstream — monorepo

This repository is a [pnpm workspace](https://pnpm.io/workspaces) containing
the **`fetchstream`** library and its runnable examples.

```
fetchstream/
├── packages/
│   └── fetchstream/                # The library itself  ── see its README
├── examples/
│   ├── node/                       # Node CLI demos (server + client)
│   ├── browser/                    # Static HTML demos (no bundler)
│   └── react-vite/                 # React + Vite demo against dummyjson.com
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

| Command                     | What it does                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `pnpm test`                 | Run the library test suite (`packages/fetchstream`)            |
| `pnpm bench`                | Run the streaming-vs-`JSON.parse` benchmark                    |
| `pnpm dev:react`            | Start the React + Vite example on <http://localhost:5173>      |
| `pnpm build:react`          | Production build of the React example                          |
| `pnpm demo:server`          | Start the slow Node JSON streamer (used by the browser demos)  |
| `pnpm demo:node`            | Run the Node consumer example (talks to `demo:server`)         |
| `pnpm demo:live`            | Run the Node live-mirror example                               |

You can also drop into any workspace and use its scripts directly:

```bash
pnpm -F fetchstream test
pnpm -F @fetchstream/react-vite-example dev
pnpm -F @fetchstream/node-examples server
```

## Packages

| Workspace                          | Path                       | Description                                |
| ---------------------------------- | -------------------------- | ------------------------------------------ |
| `fetchstream`                      | `packages/fetchstream`     | The streaming JSON parser library          |
| `@fetchstream/node-examples`       | `examples/node`            | `server.mjs`, `node-example.mjs`, `live-node.mjs` |
| `@fetchstream/react-vite-example`  | `examples/react-vite`      | React + Vite demo using dummyjson.com      |

The library docs (API, path syntax, design notes, benchmarks) live in
[`packages/fetchstream/README.md`](packages/fetchstream/README.md).
