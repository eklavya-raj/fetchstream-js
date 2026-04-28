// Tests for the low-level SAX parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSONStreamParser } from '../src/parser.js';

const enc = new TextEncoder();

function recordEvents(input, chunkSize = Infinity) {
  const events = [];
  const parser = new JSONStreamParser({
    onStartObject: () => events.push(['{']),
    onEndObject:   () => events.push(['}']),
    onStartArray:  () => events.push(['[']),
    onEndArray:    () => events.push([']']),
    onKey:         (k) => events.push(['k', k]),
    onValue:       (v) => events.push(['v', v]),
    onEnd:         () => events.push(['end']),
    onError:       (e) => { throw e; },
  });
  const bytes = enc.encode(input);
  if (chunkSize >= bytes.length) {
    parser.write(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += chunkSize) {
      parser.write(bytes.subarray(i, Math.min(bytes.length, i + chunkSize)));
    }
  }
  parser.end();
  return events;
}

// Apply parser by reconstructing value via builder.
function reconstruct(input, chunkSize = Infinity) {
  const stack = [];
  let root;
  let curKey = null;
  function add(v) {
    if (stack.length === 0) { root = v; return; }
    const top = stack[stack.length - 1];
    if (Array.isArray(top)) top.push(v);
    else top[curKey] = v;
  }
  const parser = new JSONStreamParser({
    onStartObject: () => { const o = {}; add(o); stack.push(o); },
    onEndObject:   () => { stack.pop(); },
    onStartArray:  () => { const a = []; add(a); stack.push(a); },
    onEndArray:    () => { stack.pop(); },
    onKey:         (k) => { curKey = k; },
    onValue:       (v) => { add(v); },
    onError:       (e) => { throw e; },
  });
  const bytes = enc.encode(input);
  if (chunkSize >= bytes.length) {
    parser.write(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += chunkSize) {
      parser.write(bytes.subarray(i, Math.min(bytes.length, i + chunkSize)));
    }
  }
  parser.end();
  return root;
}

// Round-trip test for each chunk size to verify cross-chunk handling.
function roundTrip(t, label, json) {
  const expected = JSON.parse(json);
  for (const chunkSize of [Infinity, 64, 16, 4, 2, 1]) {
    const got = reconstruct(json, chunkSize);
    assert.deepStrictEqual(got, expected, `${label} (chunkSize=${chunkSize})`);
  }
}

// ---- primitive top-level values ----
test('primitive: number', (t) => roundTrip(t, 'num', '123'));
test('primitive: negative number', (t) => roundTrip(t, 'neg', '-42.5'));
test('primitive: exponent', (t) => roundTrip(t, 'exp', '1.5e3'));
test('primitive: large exponent', (t) => roundTrip(t, 'exp2', '-3.14E-10'));
test('primitive: zero', (t) => roundTrip(t, 'zero', '0'));
test('primitive: string', (t) => roundTrip(t, 'str', '"hello world"'));
test('primitive: empty string', (t) => roundTrip(t, 'empty str', '""'));
test('primitive: true', (t) => roundTrip(t, 'true', 'true'));
test('primitive: false', (t) => roundTrip(t, 'false', 'false'));
test('primitive: null', (t) => roundTrip(t, 'null', 'null'));

// ---- empty containers ----
test('empty: object', (t) => roundTrip(t, '{}', '{}'));
test('empty: array', (t) => roundTrip(t, '[]', '[]'));
test('empty: nested object', (t) => roundTrip(t, '{"a": {}}', '{"a":{}}'));
test('empty: nested array', (t) => roundTrip(t, '{"a": []}', '{"a":[]}'));

// ---- flat objects ----
test('flat object: only keys', (t) => {
  roundTrip(t, 'flat', '{"id":1,"name":"Alice","active":true,"role":null}');
});

// ---- flat arrays ----
test('flat array of numbers', (t) => roundTrip(t, 'arr nums', '[1,2,3,4,5]'));
test('flat array of strings', (t) => roundTrip(t, 'arr strs', '["a","b","c"]'));
test('flat array of mixed primitives', (t) =>
  roundTrip(t, 'mixed', '[1,"two",true,null,3.14]'));

// ---- nested ----
test('nested: object with arrays of objects', (t) => {
  const json = JSON.stringify({
    users: [
      { id: 1, name: 'Alice', tags: ['x', 'y'] },
      { id: 2, name: 'Bob',   tags: [] },
      { id: 3, name: 'Çağla', tags: ['z'] },
    ],
    meta: { total: 3, page: 1 },
  });
  roundTrip(t, 'nested', json);
});

test('deeply nested', (t) => {
  let json = '0';
  for (let i = 0; i < 50; i++) json = `{"a":${json}}`;
  roundTrip(t, 'deep obj', json);
  let arr = '0';
  for (let i = 0; i < 50; i++) arr = `[${arr}]`;
  roundTrip(t, 'deep arr', arr);
});

// ---- strings: escapes and unicode ----
test('string: escape sequences', (t) => {
  roundTrip(t, 'esc', '"\\"\\\\\\b\\f\\n\\r\\t/"');
});

test('string: unicode escape', (t) => {
  roundTrip(t, 'uni', '"\\u00E9 \\u4E2D \\u00FF"');
});

test('string: surrogate pair (emoji)', (t) => {
  roundTrip(t, 'surr', '"\\uD83D\\uDE00"'); // 😀
});

test('string: utf8 multibyte direct', (t) => {
  roundTrip(t, 'utf8', '"é 中 日本語 αβγ 🎉"');
});

// ---- whitespace ----
test('whitespace tolerant', (t) => {
  const json = '  {\n  "a"  :  1 ,\n  "b" : [ 1 , 2 , 3 ] ,\n  "c" : { } \n} \n';
  roundTrip(t, 'ws', json);
});

// ---- chunk-boundary stress ----
test('chunk boundary: split inside string', (t) => {
  const json = '{"name":"streaming jay\\u00E9son world"}';
  roundTrip(t, 'split str', json);
});

test('chunk boundary: split inside number', (t) => {
  roundTrip(t, 'split num', '{"x":-12345.6789e+10}');
});

test('chunk boundary: split inside keyword', (t) => {
  roundTrip(t, 'split true', '{"a":true,"b":false,"c":null}');
});

test('chunk boundary: split inside unicode escape', (t) => {
  roundTrip(t, 'split uni', '"\\uD83D\\uDE00 hello \\u00E9"');
});

// ---- invalid input ----
test('invalid: trailing comma', () => {
  assert.throws(() => reconstruct('[1,2,]'));
  assert.throws(() => reconstruct('{"a":1,}'));
});

test('invalid: unquoted key', () => {
  assert.throws(() => reconstruct('{a:1}'));
});

test('invalid: trailing junk', () => {
  assert.throws(() => reconstruct('1 2'));
});

test('invalid: unterminated string', () => {
  assert.throws(() => reconstruct('"abc'));
});

test('invalid: bad escape', () => {
  assert.throws(() => reconstruct('"\\x"'));
});

// ---- event ordering sanity ----
test('events: object event order', () => {
  const ev = recordEvents('{"a":1,"b":[2,3]}');
  assert.deepStrictEqual(ev, [
    ['{'],
    ['k', 'a'], ['v', 1],
    ['k', 'b'], ['['], ['v', 2], ['v', 3], [']'],
    ['}'],
    ['end'],
  ]);
});

test('events: deeply chunked produces same events', () => {
  const json = '{"users":[{"id":1,"n":"A"},{"id":2,"n":"B"}],"meta":{"total":2}}';
  const ref = recordEvents(json, Infinity);
  for (const cs of [1, 2, 3, 5, 7, 13, 17]) {
    const got = recordEvents(json, cs);
    assert.deepStrictEqual(got, ref, 'chunkSize=' + cs);
  }
});

// ---- big array stress ----
test('large array reconstruction', () => {
  const arr = [];
  for (let i = 0; i < 5000; i++) arr.push({ i, s: 'x'.repeat(i % 10) });
  const json = JSON.stringify(arr);
  const got = reconstruct(json, 251);
  assert.deepStrictEqual(got, arr);
});
