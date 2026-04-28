# API reference

`fetchstream-js` ships a small, focused public surface. Everything you need is exported from the root entry point; framework- and runtime-specific extras live under subpath imports.

## Subpath imports

| Import path             | Provides                                                  |
| ----------------------- | --------------------------------------------------------- |
| `fetchstream-js`        | `fetchStream`, `streamJSON`, `parse`, `StreamHandle`      |
| `fetchstream-js/node`   | Everything above, plus `streamFrom(source)`               |
| `fetchstream-js/parser` | `JSONStreamParser` (low-level SAX)                        |
| `fetchstream-js/picker` | `StreamPicker` (path-aware materializer)                  |
| `fetchstream-js/path`   | `compilePath`, `matches`, `prefixMatches`, `pathToString` |

## Top-level functions

- [`fetchStream(url, options?)`](/api/fetch-stream) — the headline API; mirrors `fetch()`
- [`streamJSON()`](/api/stream-json) — a handle for manual feeding
- [`parse(text)`](/api/parse) — synchronous one-shot parser

## Types

- [`StreamHandle`](/api/stream-handle) — chainable, awaitable handle returned by every entry point

## Low-level primitives

- [`JSONStreamParser`](/api/json-stream-parser) — raw SAX events, no path matching, no value materialization

## Conventions

- Every async API supports `AbortSignal` via `options.signal`
- Every callback receives the value as the first argument and the path stack as the second
- Every `StreamHandle` is awaitable — `await handle` resolves when the stream ends
- All path expressions follow the [path syntax](/guide/paths) spec
