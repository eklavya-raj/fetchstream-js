# Async iteration

Use `.iterate(path)` when you want to consume matches with **backpressure** — your loop body blocks the parser until your handler finishes.

```js
for await (const product of fetchStream("/api/products").iterate("$.products.*")) {
  await render(product); // parser pauses here
}
```

## When to use

| Pattern | Backpressure | Best for |
| ------- | :----------: | -------- |
| `.on(path, cb)` | ❌ no | UI rendering, fire-and-forget |
| `.iterate(path)` | ✅ yes | DB writes, network forwarding, slow consumers |
| `.live(cb)` | ❌ no | progressive UI rendering |

`.on()` is fastest because the parser never waits. `.iterate()` is safer when each match triggers slow async work.

## Examples

### Save each item to a database

```js
for await (const order of fetchStream("/exports/orders.json").iterate("$.orders.*")) {
  await db.orders.insert(order);
}
console.log("All saved.");
```

The parser only pulls the next chunk **after** `db.orders.insert` resolves. No memory blow-up, no overwhelmed downstream service.

### Forward to another stream

```js
for await (const event of fetchStream("/events.json").iterate("$.events.*")) {
  await kafka.send("topic.events", event);
}
```

### Early termination

`break` cancels the body reader:

```js
for await (const user of fetchStream(url).iterate("$.users.*")) {
  if (user.id === target) {
    return user;        // body is canceled, network stops
  }
}
```

## Combining patterns

You can mix `.iterate()` with `.on()` for sibling subscriptions that don't need backpressure:

```js
const stream = fetchStream(url).on("$.totalCount", (n) => setTotal(n));

for await (const item of stream.iterate("$.items.*")) {
  await render(item);
}
```

`$.totalCount` fires its callback eagerly while the loop is still iterating items.

## Errors

Errors from the parser, the network, or your loop body propagate normally:

```js
try {
  for await (const item of fetchStream(url).iterate("$.items.*")) {
    if (!item.valid) throw new Error("bad item");
  }
} catch (err) {
  console.error(err);
}
```

The body reader is always canceled on error, so no further bytes are pulled.
