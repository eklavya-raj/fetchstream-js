# JSONStreamParser

The low-level SAX parser. No path matching, no value materialization — just raw events as the byte stream is consumed.

```js
import { JSONStreamParser } from "fetchstream/parser";
```

## Usage

```js
import { JSONStreamParser } from "fetchstream/parser";

const parser = new JSONStreamParser({
  onStartObject() { /* ... */ },
  onEndObject()   { /* ... */ },
  onStartArray()  { /* ... */ },
  onEndArray()    { /* ... */ },
  onKey(name)     { /* ... */ },
  onValue(value)  { /* string | number | boolean | null */ },
  onEnd()         { /* ... */ },
  onError(err)    { /* ... */ },
});

parser.write(uint8ArrayChunk);
parser.write(anotherChunk);
parser.end();
```

## When to use

You almost certainly want [`fetchStream`](/api/fetch-stream) or [`streamJSON`](/api/stream-json) instead. Reach for `JSONStreamParser` only when:

- You're building your own path-based system on top
- You need the absolute minimum overhead (no picker, no Promise chain)
- You want to forward events to a non-JS consumer (Wasm, worker, native binding)

## Event semantics

| Event | Fires when |
| ----- | ---------- |
| `onStartObject` | Parser sees `{` |
| `onEndObject` | Parser sees `}` |
| `onStartArray` | Parser sees `[` |
| `onEndArray` | Parser sees `]` |
| `onKey(name)` | Parser finishes a string in key position |
| `onValue(v)` | Parser finishes a leaf value (string, number, boolean, null) |
| `onEnd` | `parser.end()` was called and any trailing whitespace consumed |
| `onError(err)` | Malformed input — the parser cannot continue after this |

## Cross-chunk safety

Strings, numbers, and keyword literals can be split across any number of chunks. Partial byte slices are stitched together internally and decoded once on completion to keep multi-byte UTF-8 intact.

You can call `.write()` with chunks of any size — including `1` byte at a time — and produce identical events.

## Performance notes

- The parser is a single hand-rolled state machine over `Uint8Array`
- JSON's structural characters (`{ } [ ] , : "`) are all ASCII (< `0x80`), so they cannot collide with UTF-8 continuation bytes
- Strings are scanned byte-by-byte without invoking `TextDecoder` until the closing `"`
- Numbers are parsed once per number, on the byte after the last digit

This means the hottest hot path lives almost entirely in inlined JS without any JS-string allocation.
