// fetchstream/src/path.js
// Compile a JSONPath-lite string into segments, plus a fast `matches()` test.
//
// Supported syntax:
//   $              -> root value
//   $.key          -> child key
//   $.key.sub      -> chained child keys
//   $.key.*        -> any object key or any array element at that level
//   $.key[*]       -> same as .* (array element wildcard)
//   $.key[0]       -> specific array index
//   $.key["weird name"]  -> bracket-quoted key (allows dots/brackets in name)
//   $.key.sub.**   -> NOT supported in v1 (intentional; keep it predictable & fast)

export const SEG_KEY = 1;
export const SEG_INDEX = 2;
export const SEG_WILD = 3;

export function compilePath(path) {
  if (path == null) throw new Error('path required');
  if (typeof path !== 'string') throw new Error('path must be a string');
  if (path.length === 0 || path === '$') return [];
  if (path[0] !== '$') throw new Error("Path must start with '$': " + path);

  const segs = [];
  let i = 1;
  const n = path.length;
  while (i < n) {
    const c = path[i];
    if (c === '.') {
      i++;
      if (i >= n) throw new Error('Trailing . in path');
      if (path[i] === '*') {
        segs.push({ type: SEG_WILD });
        i++;
        continue;
      }
      // read identifier-like key until '.', '[' or end
      let j = i;
      while (j < n && path[j] !== '.' && path[j] !== '[') j++;
      if (j === i) throw new Error('Empty key in path: ' + path);
      segs.push({ type: SEG_KEY, value: path.slice(i, j) });
      i = j;
    } else if (c === '[') {
      i++;
      if (i >= n) throw new Error('Unclosed [ in path');
      const ch = path[i];
      if (ch === '*') {
        segs.push({ type: SEG_WILD });
        i++;
        if (path[i] !== ']') throw new Error("Expected ']'");
        i++;
      } else if (ch === '"' || ch === "'") {
        const q = ch;
        i++;
        let j = i;
        while (j < n && path[j] !== q) {
          if (path[j] === '\\' && j + 1 < n) j += 2;
          else j++;
        }
        if (j >= n) throw new Error('Unterminated quoted key in path');
        const raw = path.slice(i, j).replace(/\\(.)/g, '$1');
        segs.push({ type: SEG_KEY, value: raw });
        i = j + 1;
        if (path[i] !== ']') throw new Error("Expected ']'");
        i++;
      } else {
        let j = i;
        while (j < n && path[j] !== ']') j++;
        if (j >= n) throw new Error("Expected ']'");
        const numStr = path.slice(i, j);
        const num = Number(numStr);
        if (!Number.isInteger(num) || num < 0) {
          throw new Error('Invalid array index: ' + numStr);
        }
        segs.push({ type: SEG_INDEX, value: num });
        i = j + 1;
      }
    } else {
      throw new Error("Unexpected '" + c + "' in path: " + path);
    }
  }
  return segs;
}

// Returns true iff segments fully match pathStack (same length, all components match).
export function matches(segments, pathStack) {
  const n = segments.length;
  if (n !== pathStack.length) return false;
  for (let i = 0; i < n; i++) {
    const s = segments[i];
    if (s.type === SEG_WILD) continue;
    const p = pathStack[i];
    if (s.type === SEG_KEY) {
      if (typeof p !== 'string' || p !== s.value) return false;
    } else { // SEG_INDEX
      if (typeof p !== 'number' || p !== s.value) return false;
    }
  }
  return true;
}

// Returns true iff segments[0..pathStack.length-1] matches pathStack
// (i.e. it's still possible that going deeper could match this subscription).
export function prefixMatches(segments, pathStack) {
  if (pathStack.length > segments.length) return false;
  for (let i = 0; i < pathStack.length; i++) {
    const s = segments[i];
    if (s.type === SEG_WILD) continue;
    const p = pathStack[i];
    if (s.type === SEG_KEY) {
      if (typeof p !== 'string' || p !== s.value) return false;
    } else {
      if (typeof p !== 'number' || p !== s.value) return false;
    }
  }
  return true;
}

export function pathToString(pathStack) {
  let s = '$';
  for (const p of pathStack) {
    if (typeof p === 'number') s += '[' + p + ']';
    else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p)) s += '.' + p;
    else s += '[' + JSON.stringify(p) + ']';
  }
  return s;
}
