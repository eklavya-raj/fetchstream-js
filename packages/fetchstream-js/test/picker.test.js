// Tests for the JSONPath-lite picker / streaming subscription layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamHandle, parse } from '../src/index.js';

function feed(json, register, chunkSize = Infinity) {
  const enc = new TextEncoder();
  const handle = new StreamHandle();
  register(handle);
  const bytes = enc.encode(json);
  if (chunkSize >= bytes.length) {
    handle.feed(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += chunkSize) {
      handle.feed(bytes.subarray(i, Math.min(bytes.length, i + chunkSize)));
    }
  }
  handle.end();
  return handle;
}

// ---- root subscription ----
test('subscribe $: root primitive', () => {
  const got = [];
  feed('42', (h) => h.on('$', (v) => got.push(v)));
  assert.deepStrictEqual(got, [42]);
});

test('subscribe $: root object', () => {
  const got = [];
  feed('{"a":1,"b":2}', (h) => h.on('$', (v) => got.push(v)));
  assert.deepStrictEqual(got, [{ a: 1, b: 2 }]);
});

test('subscribe $: root array', () => {
  const got = [];
  feed('[1,2,3]', (h) => h.on('$', (v) => got.push(v)));
  assert.deepStrictEqual(got, [[1, 2, 3]]);
});

// ---- key subscription ----
test('subscribe $.key: simple', () => {
  const got = [];
  feed('{"a":1,"b":2}', (h) => h.on('$.a', (v) => got.push(v)));
  assert.deepStrictEqual(got, [1]);
});

test('subscribe $.key.sub: nested key', () => {
  const got = [];
  feed('{"meta":{"total":42,"page":1}}', (h) => h.on('$.meta.total', (v) => got.push(v)));
  assert.deepStrictEqual(got, [42]);
});

test('subscribe $.key: missing key never fires', () => {
  const got = [];
  feed('{"a":1}', (h) => h.on('$.b', (v) => got.push(v)));
  assert.deepStrictEqual(got, []);
});

// ---- wildcard subscription on arrays ----
test('subscribe $.users.*: each array element fires once', () => {
  const got = [];
  const json = '{"users":[{"id":1},{"id":2},{"id":3}]}';
  feed(json, (h) => h.on('$.users.*', (v) => got.push(v)));
  assert.deepStrictEqual(got, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test('subscribe $.tags.*: array of strings', () => {
  const got = [];
  feed('{"tags":["red","green","blue"]}', (h) => h.on('$.tags.*', (v) => got.push(v)));
  assert.deepStrictEqual(got, ['red', 'green', 'blue']);
});

test('subscribe $.tags[*]: alternative bracket syntax', () => {
  const got = [];
  feed('{"tags":["a","b"]}', (h) => h.on('$.tags[*]', (v) => got.push(v)));
  assert.deepStrictEqual(got, ['a', 'b']);
});

test('subscribe $.users[0]: specific index', () => {
  const got = [];
  feed('{"users":[{"id":1},{"id":2}]}', (h) => h.on('$.users[0]', (v) => got.push(v)));
  assert.deepStrictEqual(got, [{ id: 1 }]);
});

// ---- wildcard subscription on objects ----
test('subscribe $.dict.*: every value of object', () => {
  const got = [];
  feed('{"dict":{"a":1,"b":2,"c":3}}', (h) => h.on('$.dict.*', (v) => got.push(v)));
  assert.deepStrictEqual(got, [1, 2, 3]);
});

// ---- multiple subscriptions ----
test('multiple subs: each receives its own values', () => {
  const users = [];
  let meta;
  const json = '{"meta":{"total":2},"users":[{"id":1},{"id":2}]}';
  feed(json, (h) => h
    .on('$.users.*', (v) => users.push(v))
    .on('$.meta', (v) => { meta = v; }));
  assert.deepStrictEqual(users, [{ id: 1 }, { id: 2 }]);
  assert.deepStrictEqual(meta, { total: 2 });
});

test('overlapping subs: $.users + $.users.* both fire', () => {
  const all = [];
  const each = [];
  const json = '{"users":[1,2,3]}';
  feed(json, (h) => h
    .on('$.users', (v) => all.push(v))
    .on('$.users.*', (v) => each.push(v)));
  assert.deepStrictEqual(each, [1, 2, 3]);
  assert.deepStrictEqual(all, [[1, 2, 3]]);
});

// ---- streaming behavior: callbacks fire incrementally ----
test('streaming: callbacks fire mid-stream not after', () => {
  const enc = new TextEncoder();
  const handle = new StreamHandle();
  const calls = [];
  handle.on('$.users.*', (v) => calls.push(['fired', v]));

  const json = '{"users":[{"id":1},{"id":2},{"id":3}],"meta":{"total":3}}';
  const bytes = enc.encode(json);

  // feed byte-by-byte and check that callbacks fire after each user's `}`
  const fireOffsets = [];
  for (let i = 0; i < bytes.length; i++) {
    const before = calls.length;
    handle.feed(bytes.subarray(i, i + 1));
    if (calls.length > before) fireOffsets.push(i);
  }
  handle.end();

  assert.equal(calls.length, 3, 'three users should fire');
  // Each fire should happen well before the entire stream ends
  for (const off of fireOffsets) {
    assert.ok(off < bytes.length - 1, 'callback fired before final byte: offset ' + off);
  }
});

// ---- chunk-size invariance ----
test('chunked: same results regardless of chunk size', () => {
  const json = '{"users":[{"id":1,"name":"Alice","tags":["x","y"]},'
             + '{"id":2,"name":"Bob","tags":[]},'
             + '{"id":3,"name":"Çağla","tags":["z","🎉"]}],'
             + '"meta":{"total":3,"page":1}}';
  const reference = [];
  feed(json, (h) => h.on('$.users.*', (v) => reference.push(v)));
  for (const cs of [1, 2, 3, 5, 8, 13, 32]) {
    const got = [];
    feed(json, (h) => h.on('$.users.*', (v) => got.push(v)), cs);
    assert.deepStrictEqual(got, reference, 'chunkSize=' + cs);
  }
});

// ---- async iterator API ----
test('iterate: async iterator yields each match', async () => {
  const enc = new TextEncoder();
  const handle = new StreamHandle();
  const it = handle.iterate('$.users.*');

  const json = '{"users":[{"id":1},{"id":2},{"id":3}]}';
  const bytes = enc.encode(json);
  // spread feed across microtasks to mimic streaming
  setImmediate(() => {
    for (let i = 0; i < bytes.length; i += 5) {
      handle.feed(bytes.subarray(i, Math.min(bytes.length, i + 5)));
    }
    handle.end();
  });

  const collected = [];
  for await (const u of it) collected.push(u);
  assert.deepStrictEqual(collected, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

// ---- parse() convenience ----
test('parse(): equivalent to JSON.parse for round-trippable values', () => {
  const samples = [
    '{}', '[]', '0', 'null', 'true', 'false', '"x"',
    '[1,2,3]',
    '{"a":1,"b":[2,3,{"c":[true,false,null]}]}',
    '{"u":"\\uD83D\\uDE00"}',
  ];
  for (const s of samples) {
    assert.deepStrictEqual(parse(s), JSON.parse(s), s);
  }
});

// ---- bracketed quoted keys ----
test('bracket-quoted key path', () => {
  const got = [];
  const json = '{"weird key.with.dots":42}';
  feed(json, (h) => h.on('$["weird key.with.dots"]', (v) => got.push(v)));
  assert.deepStrictEqual(got, [42]);
});
