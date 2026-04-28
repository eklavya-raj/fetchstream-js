# parse()

```ts
function parse<T = unknown>(text: string): T;
```

A **synchronous one-shot parse** using the streaming parser. Equivalent to `JSON.parse` for any complete, valid JSON string.

```js
import { parse } from "fetchstream-js";

parse('{"hello": "world"}'); // -> { hello: "world" }
```

## When to use

This is mainly useful for:

- Tests / fixtures that exercise the streaming parser without spinning up a stream
- Tiny utilities that want to use the same code path as the streaming code path

For raw speed on whole strings, **prefer `JSON.parse`** — it's implemented in native code and is significantly faster.

## When NOT to use

- ❌ Don't use `parse()` to "save bytes" vs. `JSON.parse` — they return the same result, but `JSON.parse` is faster
- ❌ Don't use `parse()` for streaming — the whole point of `fetchstream-js` is incremental parsing; use `fetchStream`, `streamJSON`, or `streamFrom` instead

## Errors

Throws on malformed JSON, the same shape `JSON.parse` would throw:

```js
try {
  parse('{"broken'); // unterminated string
} catch (err) {
  console.error(err); // SyntaxError-like
}
```
