# Path syntax

Path expressions are a **deliberately small, fast subset** of JSONPath. Every expression compiles to a tiny array of segments matched against the parser's path stack — no regex, no backtracking.

## Reference

| Expression            | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `$`                   | The root value                                             |
| `$.foo`               | Object property `foo` of the root                          |
| `$.a.b.c`             | Nested keys                                                |
| `$.list.*`            | Every value of `list` (object value or array element)      |
| `$.list[*]`           | Same as `.*`                                               |
| `$.list[7]`           | Specific array index                                       |
| `$["weird key.name"]` | Bracket-quoted key (allows dots, brackets, spaces)         |

## Examples

### Array elements

```js
fetchStream(url).on("$.users.*", (user) => { /* ... */ });
// matches: $.users[0], $.users[1], $.users[2], ...
```

### Specific indices

```js
fetchStream(url).on("$.users[0]", (first) => { /* ... */ });
// fires once with the first user only
```

### Nested traversal

```js
fetchStream(url).on("$.report.sections.*.rows.*", (row) => { /* ... */ });
// matches every row in every section
```

### Unusual key names

```js
fetchStream(url).on('$["user.email"]', (email) => { /* ... */ });
// keys with dots, brackets, or spaces need bracket-quoted notation
```

### Root array

```js
fetchStream(url).on("$.*", (item) => { /* ... */ });
// for top-level arrays like [{...}, {...}, {...}]
```

## What's _not_ supported

### Recursive descent (`..`)

```js
// ❌ Not supported
fetchStream(url).on("$..price", ...);
```

Recursive descent would require holding the entire document in memory to know whether a deeper match might still appear. That defeats the purpose of streaming. Use explicit paths instead:

```js
// ✅ Equivalent in your known schema
fetchStream(url).on("$.products.*.price", ...);
fetchStream(url).on("$.featured.price", ...);
```

### Filters / expressions

```js
// ❌ Not supported
fetchStream(url).on("$.users[?(@.active==true)]", ...);
```

Filter syntax requires evaluating a sub-expression against partially-built objects, which doesn't fit the byte-streaming model. Filter on the consumer side instead:

```js
// ✅ Filter in your callback
fetchStream(url).on("$.users.*", (user) => {
  if (user.active) handle(user);
});
```

### Slicing

```js
// ❌ Not supported
fetchStream(url).on("$.users[0:5]", ...);
```

Track the index yourself:

```js
// ✅ Track index manually
let i = 0;
fetchStream(url).on("$.users.*", (user) => {
  if (i++ < 5) handle(user);
});
```

## Multiple subscriptions

Subscribe to as many paths as you want — they're matched in parallel during a single parse pass:

```js
fetchStream(url)
  .on("$.status", (s) => setStatus(s))         // fires once, very early
  .on("$.totalCount", (n) => setCount(n))      // fires once, very early
  .on("$.products.*", (p) => addProduct(p))    // fires N times
  .on("$.errors.*", (e) => logError(e));       // fires 0+ times
```

Only subtrees that match a subscription are materialized. Everything else is parsed structurally and dropped.

## Low-level API

For dynamic path matching:

```js
import { compilePath, matches } from "fetchstream/path";

const compiled = compilePath("$.users.*");
matches(compiled, ["users", 0]);   // true
matches(compiled, ["users", 5]);   // true
matches(compiled, ["meta"]);       // false
```

This is what `.on()` uses internally.
