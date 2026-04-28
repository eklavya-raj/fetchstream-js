# Why replace fetch / axios?

`fetch()` and `axios.get()` are perfectly fine HTTP clients — they're not the problem. The problem is what they do to your JSON response:

> They buffer the **entire** response body before they hand you anything.

`await res.json()` waits for the last byte. `axios.get(url)` waits for the last byte. Only then can `JSON.parse` run. Only then can your component render. For small payloads (< 100 KB) this is invisible. For any non-trivial response — product lists, analytics dumps, reports, search results — it becomes a UX problem.

## The three approaches, side by side

```js
// fetch — buffers, then parses, then renders
const data = await fetch("/api/users").then((r) => r.json()); // ⏳
render(data);

// axios — same behavior, different wrapper
const { data } = await axios.get("/api/users"); // ⏳
render(data);

// fetchstream-js — renders as bytes arrive
fetchStream("/api/users").live(({ data }) => render(data));
```

Same endpoint. Same response. Same network. Only one of them lets your user see rows before the download finishes.

## The blocking flow

```
 Network    ████████████████████████  3000 ms
 Parse                              ██ 50 ms
 Render                               █ 16 ms
 ────────────────────────────────────────────
 User sees                             ↑
                                   at 3066 ms
```

The user stares at a spinner for 3 seconds. The browser has been downloading data the entire time — but it's all invisible until `response.json()` resolves.

## The streaming flow

```
 Network    ████████████████████████  3000 ms
 Parse      ░░░░░░░░░░░░░░░░░░░░░░░░  (continuous)
 Render     ░░░░░░░░░░░░░░░░░░░░░░░░  (continuous)
 ────────────────────────────────────────────
 User sees  ↑
         at 12 ms — growing from there
```

The user sees row #1 almost immediately. Rows #2, #3, ... pour in as their bytes arrive. The final frame paints at the same time as the blocking approach — both are bottlenecked by network speed — but **time-to-first-paint drops by ~260×**.

## Real-world benchmark

Streaming 20 000 items in 16 KiB chunks, throttled to 4 ms per chunk (≈3.2 MB total, ~50 Mbps link):

| Approach                    | First item | Last item | Blocked UI? |
| --------------------------- | ---------: | --------: | :---------: |
| `fetch().json()` + render   |   ~3134 ms |   3134 ms |     yes     |
| `fetchStream` `$.results.*` |     ~12 ms |   3116 ms |     no      |

## When it matters

Use `fetchstream-js` when **any** of these apply:

- Responses are larger than ~500 KB
- Users are on slow/mobile networks
- Your endpoint is slow (analytics, reports, large dumps)
- You want streaming **during** a server-rendered SSR render
- The user should be able to start interacting before the response finishes

## When it doesn't

Stick with `JSON.parse` when:

- Responses are small (under ~100 KB)
- You need the full document before doing anything (e.g. you're computing a hash)
- You already have the whole string in memory
- Total throughput matters more than time-to-first-byte

`fetchstream-js` isn't faster at parsing the full document — `JSON.parse` wins on raw throughput because it runs in native code. `fetchstream-js` wins on **perceived performance** by moving work forward in time.

## Bonus: selective materialization

Because `fetchstream-js` knows your subscription paths, it only allocates objects for subtrees you asked for. A subscription on `$.users.*` in a response like:

```json
{
  "metadata": {
    /* 500 KB of stuff you don't care about */
  },
  "users": [
    /* what you actually want */
  ]
}
```

...will parse the `metadata` section but not build any JS objects for it. Less GC pressure, less memory, faster parsing.
