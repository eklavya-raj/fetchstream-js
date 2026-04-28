// Tests for live() / onProgress() / snapshot -- the "progressive mirror" mode.
// Covers the three scenarios described in the readme examples:
//   1. Root object of keyed entries
//   2. Root array of objects
//   3. Nested object containing multiple arrays
import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamHandle } from '../src/index.js';

const enc = new TextEncoder();

// Feed `json` byte-by-byte (or in tiny chunks) and capture a snapshot of the
// live root after EACH chunk. Returns the list of observed snapshots (JSON-
// stringified, so we can deep-compare values at each moment in time).
function feedAndRecord(json, register, chunkSize = 1) {
  const handle = new StreamHandle();
  const states = [];
  register(handle, states);

  const bytes = enc.encode(json);
  for (let i = 0; i < bytes.length; i += chunkSize) {
    handle.feed(bytes.subarray(i, Math.min(bytes.length, i + chunkSize)));
  }
  handle.end();
  return states;
}

// ----------------------------------------------------------------------
// 1) Root object with keyed user entries grows in place.
// ----------------------------------------------------------------------
test('live: root object { user1, user2, user3 } grows in place', () => {
  const json = '{'
    + '"user1":{"name":"Alex","age":22},'
    + '"user2":{"name":"Sam","age":25},'
    + '"user3":{"name":"John","age":28}'
    + '}';

  // Track snapshots taken right after each top-level entry completes.
  const afterUser1 = {};
  const afterUser2 = {};
  const afterUser3 = {};

  const handle = new StreamHandle();
  let firedCount = 0;
  handle.live((root) => {
    // Keep deep-cloning only at moments of interest below.
    if (firedCount === 0 && root.user1 && root.user1.age !== undefined && !root.user2) {
      Object.assign(afterUser1, JSON.parse(JSON.stringify(root)));
    }
    if (firedCount === 0 && root.user2 && root.user2.age !== undefined && !root.user3) {
      Object.assign(afterUser2, JSON.parse(JSON.stringify(root)));
    }
    if (root.user3 && root.user3.age !== undefined) {
      Object.assign(afterUser3, JSON.parse(JSON.stringify(root)));
      firedCount++;
    }
  });

  // Actually feed everything in one shot for this assertion -- the live
  // callback fires for every mutation regardless of chunking.
  handle.feed(enc.encode(json));
  handle.end();

  // After user1 fully arrived but user2 hadn't started, snapshot matched:
  assert.deepStrictEqual(afterUser1, { user1: { name: 'Alex', age: 22 } });

  // After user2 was committed but user3 hadn't started:
  assert.deepStrictEqual(afterUser2, {
    user1: { name: 'Alex', age: 22 },
    user2: { name: 'Sam', age: 25 },
  });

  // Final state:
  assert.deepStrictEqual(afterUser3, {
    user1: { name: 'Alex', age: 22 },
    user2: { name: 'Sam', age: 25 },
    user3: { name: 'John', age: 28 },
  });

  // And snapshot stays available after end.
  assert.deepStrictEqual(handle.snapshot, {
    user1: { name: 'Alex', age: 22 },
    user2: { name: 'Sam', age: 25 },
    user3: { name: 'John', age: 28 },
  });
});

// ----------------------------------------------------------------------
// 2) Root array grows element by element.
// ----------------------------------------------------------------------
test('live: root array of objects grows one element at a time', () => {
  const json = '['
    + '{"name":"Alex","age":22},'
    + '{"name":"Sam","age":25},'
    + '{"name":"John","age":28}'
    + ']';

  // Feed byte-by-byte, and after each byte record the "size-at-commit-boundary" of the array.
  const commits = [];           // snapshots captured each time a top-level element COMPLETED
  let prevLen = 0;

  const handle = new StreamHandle();
  handle.live((root) => {
    if (!Array.isArray(root)) return;
    // A commit happens when the array length grew AND the newest element is an object
    // that now has all of its properties assembled. We approximate "committed" as
    // "the element is present and its last property (age) is defined."
    const last = root.length > 0 ? root[root.length - 1] : null;
    if (root.length > prevLen && last && typeof last.age === 'number') {
      commits.push(JSON.parse(JSON.stringify(root)));
      prevLen = root.length;
    }
  });

  const bytes = enc.encode(json);
  for (let i = 0; i < bytes.length; i++) handle.feed(bytes.subarray(i, i + 1));
  handle.end();

  assert.deepStrictEqual(commits[0], [{ name: 'Alex', age: 22 }]);
  assert.deepStrictEqual(commits[1], [
    { name: 'Alex', age: 22 },
    { name: 'Sam',  age: 25 },
  ]);
  assert.deepStrictEqual(commits[2], [
    { name: 'Alex', age: 22 },
    { name: 'Sam',  age: 25 },
    { name: 'John', age: 28 },
  ]);
});

// ----------------------------------------------------------------------
// 3) Nested: { students: [...], teachers: [...], admins: [...] } builds
//    progressively and the first visible "complete shape" is
//    { students: [{ name: 'Alex' }] }.
// ----------------------------------------------------------------------
test('live: nested object with multiple arrays grows progressively', () => {
  const json = '{'
    + '"students":['
      + '{"name":"Alex"},'
      + '{"name":"Sam"}'
    + '],'
    + '"teachers":['
      + '{"name":"David"},'
      + '{"name":"Emma"}'
    + '],'
    + '"admins":['
      + '{"name":"Mike"},'
      + '{"name":"Sara"}'
    + ']'
  + '}';

  let afterFirstStudent = null;
  const handle = new StreamHandle();
  handle.live((root) => {
    if (afterFirstStudent) return;
    if (root.students && root.students.length === 1 && root.students[0].name === 'Alex') {
      // Exactly one student committed, no teachers/admins yet.
      afterFirstStudent = JSON.parse(JSON.stringify(root));
    }
  });

  const bytes = enc.encode(json);
  for (let i = 0; i < bytes.length; i++) handle.feed(bytes.subarray(i, i + 1));
  handle.end();

  assert.deepStrictEqual(afterFirstStudent, {
    students: [{ name: 'Alex' }],
  });

  // Final shape.
  assert.deepStrictEqual(handle.snapshot, {
    students: [{ name: 'Alex' }, { name: 'Sam' }],
    teachers: [{ name: 'David' }, { name: 'Emma' }],
    admins:   [{ name: 'Mike' }, { name: 'Sara' }],
  });
});

// ----------------------------------------------------------------------
// live() works with root primitives too.
// ----------------------------------------------------------------------
test('live: root primitive fires exactly once with the value', () => {
  const calls = [];
  const handle = new StreamHandle();
  handle.live(v => calls.push(v));
  handle.feed(enc.encode('42'));
  handle.end();
  assert.deepStrictEqual(calls, [42]);
  assert.equal(handle.snapshot, 42);
});

// ----------------------------------------------------------------------
// onProgress at a subtree path.
// ----------------------------------------------------------------------
test('onProgress: scoped to a subtree', () => {
  const json = '{"meta":{"total":3},"students":[{"name":"A"},{"name":"B"},{"name":"C"}]}';
  const observedStudents = [];
  const handle = new StreamHandle();
  handle.onProgress('$.students', (arr) => {
    observedStudents.push(JSON.parse(JSON.stringify(arr)));
  });
  handle.feed(enc.encode(json));
  handle.end();

  // We should have seen the students array grow from [] -> 1 -> 2 -> 3 elements
  // (plus some extra firings when per-element objects get added field by field --
  // we only check the committed-size progression here).
  const sizes = observedStudents.map(a => a.length);
  assert.ok(sizes.includes(0), 'empty array visible');
  assert.ok(sizes.includes(1), 'after 1 student');
  assert.ok(sizes.includes(2), 'after 2 students');
  assert.ok(sizes.includes(3), 'after 3 students');

  const last = observedStudents[observedStudents.length - 1];
  assert.deepStrictEqual(last, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
});

// ----------------------------------------------------------------------
// live() and .on() can be used together.
// ----------------------------------------------------------------------
test('live + on: mirror and per-item callbacks both work', () => {
  const json = '{"users":[{"id":1},{"id":2},{"id":3}]}';
  const items = [];
  let finalRoot = null;
  const handle = new StreamHandle();
  handle
    .live(r => { finalRoot = r; })
    .on('$.users.*', u => items.push(u));

  handle.feed(enc.encode(json));
  handle.end();

  assert.deepStrictEqual(items, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepStrictEqual(finalRoot, { users: [{ id: 1 }, { id: 2 }, { id: 3 }] });
});

// ----------------------------------------------------------------------
// Defensive: feed/feedText/end after _error() are no-ops. (Production
// hardening so a stale producer can't crash a stream that's already
// surfaced an error to the consumer.)
// ----------------------------------------------------------------------
test('feed/end after error are no-ops; rejection is final', async () => {
  const handle = new StreamHandle();
  let rejection;
  handle.then(() => {}, (e) => { rejection = e; });

  const boom = new Error('boom');
  handle._error(boom);

  // None of these should throw.
  handle.feed(enc.encode('{"ignored":1}'));
  handle.feedText('{"also":"ignored"}');
  handle.end();

  // A second _error must not double-reject or throw.
  handle._error(new Error('again'));

  // microtask flush
  await Promise.resolve();
  assert.strictEqual(rejection, boom);
});

// ----------------------------------------------------------------------
// Throttle: numeric ms coalesces many mutations into a single delivery
// and flushes the final state synchronously on end().
// ----------------------------------------------------------------------
test('live({ throttle: <ms> }): coalesces updates, final flush on end()', async () => {
  const json = '{"a":1,"b":2,"c":3}';
  const calls = [];

  const handle = new StreamHandle();
  handle.live((root) => {
    calls.push(JSON.parse(JSON.stringify(root)));
  }, { throttle: 50 });

  // Feed everything synchronously; many parser mutations happen back-to-back.
  handle.feed(enc.encode(json));
  // No timer has fired yet -> nothing delivered to the user.
  assert.equal(calls.length, 0, 'no callback before first tick');

  // end() must flush synchronously so consumers always observe the final state.
  handle.end();
  await handle;

  assert.equal(calls.length, 1, 'exactly one coalesced delivery');
  assert.deepStrictEqual(calls[0], { a: 1, b: 2, c: 3 });
});

// ----------------------------------------------------------------------
// Throttle: 'raf' uses requestAnimationFrame in browsers; in Node it
// falls back to a ~16ms setTimeout. Either way the contract is the same:
// at most one delivery per frame, plus a guaranteed final flush on end().
// ----------------------------------------------------------------------
test('live({ throttle: "raf" }): coalesces and flushes on end (Node fallback)', async () => {
  const json = '[{"id":1},{"id":2},{"id":3}]';
  const calls = [];

  const handle = new StreamHandle();
  handle.live((root) => {
    calls.push(JSON.parse(JSON.stringify(root)));
  }, { throttle: 'raf' });

  handle.feed(enc.encode(json));
  assert.equal(calls.length, 0, 'no synchronous delivery while throttled');

  handle.end();
  await handle;

  assert.equal(calls.length, 1, 'exactly one delivery after flush-on-end');
  assert.deepStrictEqual(calls[0], [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

// ----------------------------------------------------------------------
// Throttle: 'raf' actually uses globalThis.requestAnimationFrame when
// present. We install a fake one to verify the wiring.
// ----------------------------------------------------------------------
test('live({ throttle: "raf" }): uses globalThis.requestAnimationFrame when defined', async () => {
  const queue = [];
  const fakeRaf  = (fn) => { queue.push(fn); return queue.length; };
  const fakeCaf  = () => {};

  const prevRaf = globalThis.requestAnimationFrame;
  const prevCaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = fakeRaf;
  globalThis.cancelAnimationFrame  = fakeCaf;

  try {
    const handle = new StreamHandle();
    const calls = [];
    handle.live((root) => { calls.push(root.x); }, { throttle: 'raf' });

    handle.feed(enc.encode('{"x":'));
    handle.feed(enc.encode('1}'));

    // requestAnimationFrame was scheduled at least once but never fired.
    assert.ok(queue.length >= 1, 'raf was scheduled');
    assert.equal(calls.length, 0, 'fake rAF never fired -> no delivery yet');

    // end() flushes synchronously, bypassing the fake rAF.
    handle.end();
    await handle;
    assert.deepStrictEqual(calls, [1]);
  } finally {
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame  = prevCaf;
  }
});

// ----------------------------------------------------------------------
// onProgress(path, cb, { throttle }) works on subtree paths too.
// ----------------------------------------------------------------------
test('onProgress({ throttle: <ms> }) on a subtree', async () => {
  const json = '{"items":[1,2,3,4,5]}';
  const seen = [];

  const handle = new StreamHandle();
  handle.onProgress('$.items', (arr) => {
    seen.push(arr.slice());
  }, { throttle: 50 });

  handle.feed(enc.encode(json));
  assert.equal(seen.length, 0);
  handle.end();
  await handle;

  assert.equal(seen.length, 1);
  assert.deepStrictEqual(seen[0], [1, 2, 3, 4, 5]);
});

// ----------------------------------------------------------------------
// Chunking invariance: final snapshot matches regardless of chunk size.
// ----------------------------------------------------------------------
test('live: final snapshot is chunk-size independent', () => {
  const json = '{"a":[1,2,3],"b":{"x":true,"y":[{"z":"hi"}]},"c":"tail"}';
  const reference = JSON.parse(json);

  for (const cs of [Infinity, 1, 2, 3, 7, 16, 64]) {
    const h = new StreamHandle();
    h.live(() => {});
    const bytes = enc.encode(json);
    if (cs === Infinity) {
      h.feed(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += cs) {
        h.feed(bytes.subarray(i, Math.min(bytes.length, i + cs)));
      }
    }
    h.end();
    assert.deepStrictEqual(h.snapshot, reference, 'chunkSize=' + cs);
  }
});
