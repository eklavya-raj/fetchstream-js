// fetchstream/src/picker.js
// Layer on top of JSONStreamParser that:
//   - tracks the current path inside the JSON document
//   - lets the user subscribe to paths via JSONPath-lite strings
//   - materializes ONLY the subtrees that match a subscription
//   - skips materialization for everything else (huge speed win for sparse selections)
//
// API:
//   const picker = new StreamPicker();
//   picker.on('$.users.*', user => ...);
//   picker.on('$.meta',   meta => ...);
//   parser = new JSONStreamParser(picker.handlers());
//
// You can also use picker as an event source for the raw SAX events (`onAny`).

import { compilePath, matches, prefixMatches, pathToString } from './path.js';

const C_OBJ = 1;
const C_ARR = 2;

class Builder {
  constructor() {
    this.root = undefined;
    this.hasRoot = false;
    this._stack = []; // [{value, key|null}]
  }
  startObject() {
    const o = {};
    this._add(o);
    this._stack.push({ value: o, key: null, isArray: false });
  }
  startArray() {
    const a = [];
    this._add(a);
    this._stack.push({ value: a, key: null, isArray: true });
  }
  endContainer() {
    this._stack.pop();
  }
  key(k) {
    this._stack[this._stack.length - 1].key = k;
  }
  value(v) {
    this._add(v);
  }
  _add(v) {
    if (this._stack.length === 0) {
      this.root = v;
      this.hasRoot = true;
    } else {
      const top = this._stack[this._stack.length - 1];
      if (top.isArray) top.value.push(v);
      else top.value[top.key] = v;
    }
  }
  isComplete() {
    return this.hasRoot && this._stack.length === 0;
  }
}

export class StreamPicker {
  constructor() {
    this._subs = [];           // {segments, callback, progress, pathString}
    this._anyListeners = [];   // raw SAX listeners

    // current parse state
    this._pathStack = [];
    this._containerStack = [];  // C_OBJ | C_ARR
    this._arrayIndex = [];      // counter per array container (top-aligned)

    // active builders: {builder, callback, path, progress}
    this._builders = [];

    // cache of the last seen live root so `snapshot` works after completion too
    this._liveRoot = undefined;
  }

  // ---- subscription API ----

  // Fires ONCE per match, after the whole value at `path` has been parsed.
  on(path, callback) {
    if (typeof callback !== 'function') throw new Error('callback must be function');
    this._subs.push({
      segments: compilePath(path),
      callback,
      progress: false,
      pathString: path,
    });
    return this;
  }

  // Fires REPEATEDLY as the value at `path` grows. Callback receives the same
  // mutable reference each time (grows in place) plus the path at which it was
  // rooted. Perfect for rendering a live mirror of the document.
  onProgress(path, callback) {
    if (typeof callback !== 'function') throw new Error('callback must be function');
    this._subs.push({
      segments: compilePath(path),
      callback,
      progress: true,
      pathString: path,
    });
    return this;
  }

  // Sugar: live mirror of the entire document (shortcut for onProgress('$', cb)).
  live(callback) {
    return this.onProgress('$', callback);
  }

  // Current partial (or final) root of the live document, or undefined if no
  // live/progress subscription is registered.
  get snapshot() {
    return this._liveRoot;
  }

  // raw SAX listener: fn(eventName, ...args)
  onAny(fn) {
    this._anyListeners.push(fn);
    return this;
  }

  // hook returns parser handlers
  handlers() {
    return {
      onStartObject: () => this._onStartObject(),
      onEndObject: () => this._onEndObject(),
      onStartArray: () => this._onStartArray(),
      onEndArray: () => this._onEndArray(),
      onKey: (k) => this._onKey(k),
      onValue: (v) => this._onValue(v),
      onError: (e) => { for (const l of this._anyListeners) l('error', e); },
      onEnd: () => { for (const l of this._anyListeners) l('end'); },
    };
  }

  // current path as a string (e.g. "$.users[3].name")
  get currentPath() {
    return pathToString(this._pathStack);
  }

  // ---- internal SAX handlers ----

  _onStartObject() {
    this._beforeValueEnter();
    this._activateMatching();
    this._dispatch('startObject');
    this._containerStack.push(C_OBJ);
  }

  _onStartArray() {
    this._beforeValueEnter();
    this._activateMatching();
    this._dispatch('startArray');
    this._containerStack.push(C_ARR);
    this._arrayIndex.push(-1);
  }

  _onEndObject() {
    this._dispatch('endObject');
    this._containerStack.pop();
    this._afterValueLeave();
  }

  _onEndArray() {
    this._dispatch('endArray');
    this._containerStack.pop();
    this._arrayIndex.pop();
    this._afterValueLeave();
  }

  _onKey(k) {
    this._pathStack.push(k);
    this._dispatch('key', k);
  }

  _onValue(v) {
    this._beforeValueEnter();
    this._activateMatching();
    this._dispatch('value', v);
    this._afterValueLeave();
  }

  // Called before the value at the current location is emitted (for arrays this needs to
  // push the index onto the path stack; for objects the key was already pushed by _onKey).
  _beforeValueEnter() {
    const top = this._containerStack[this._containerStack.length - 1];
    if (top === C_ARR) {
      const aiTop = this._arrayIndex.length - 1;
      const next = this._arrayIndex[aiTop] + 1;
      this._arrayIndex[aiTop] = next;
      this._pathStack.push(next);
    }
    // for OBJ: _onKey already pushed; for root: nothing to push
  }

  // Called after a value (primitive or container) finishes. Pops the path entry that was
  // pushed for this value's location, if any.
  _afterValueLeave() {
    if (this._containerStack.length > 0) {
      this._pathStack.pop();
    }
  }

  // Check subs at current path; for any whose full path matches, activate a builder.
  _activateMatching() {
    const subs = this._subs;
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (matches(s.segments, this._pathStack)) {
        const b = new Builder();
        this._builders.push({
          builder: b,
          callback: s.callback,
          path: this._pathStack.slice(),
          progress: s.progress,
        });
      }
    }
  }

  _dispatch(event, arg) {
    // raw listeners first
    if (this._anyListeners.length > 0) {
      for (let i = 0; i < this._anyListeners.length; i++) {
        const l = this._anyListeners[i];
        if (event === 'value' || event === 'key') l(event, arg);
        else l(event);
      }
    }

    // feed all active builders
    const bs = this._builders;
    if (bs.length === 0) return;
    for (let i = bs.length - 1; i >= 0; i--) {
      const entry = bs[i];
      const b = entry.builder;
      switch (event) {
        case 'startObject': b.startObject(); break;
        case 'startArray':  b.startArray(); break;
        case 'endObject':   b.endContainer(); break;
        case 'endArray':    b.endContainer(); break;
        case 'key':         b.key(arg); break;
        case 'value':       b.value(arg); break;
      }

      // Cache root reference on any progress builder at root (for `snapshot`).
      if (entry.progress && entry.path.length === 0 && b.hasRoot) {
        this._liveRoot = b.root;
      }

      const complete = b.isComplete();

      if (entry.progress) {
        // Fire on every mutation (start/end containers, primitives) but not on bare keys.
        if (b.hasRoot && event !== 'key') {
          try { entry.callback(b.root, entry.path); }
          catch (e) { for (const l of this._anyListeners) l('error', e); }
        }
        if (complete) bs.splice(i, 1);
      } else {
        if (complete) {
          bs.splice(i, 1);
          try { entry.callback(b.root, entry.path); }
          catch (e) { for (const l of this._anyListeners) l('error', e); }
        }
      }
    }
  }
}

export default StreamPicker;
