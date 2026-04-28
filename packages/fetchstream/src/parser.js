// fetchstream/src/parser.js
// Byte-level streaming JSON parser. Emits SAX-style events as bytes arrive.
//
// Handlers (all optional):
//   onStartObject()
//   onEndObject()
//   onStartArray()
//   onEndArray()
//   onKey(string)
//   onValue(string|number|boolean|null)
//   onError(Error)
//   onEnd()
//
// Usage:
//   const p = new JSONStreamParser(handlers);
//   p.write(uint8Array);   // call repeatedly
//   p.end();               // finalize

// --- Parser states ---
const S_VALUE        = 0;  // expect a value (start of doc, after [, after , in array, after : in object)
const S_OBJECT_FIRST = 1;  // after { -> expect key string or }
const S_OBJECT_KEY   = 2;  // after , in object -> expect key string
const S_AFTER_KEY    = 3;  // after key string -> expect :
const S_AFTER_VALUE  = 4;  // after a value inside container -> expect , or close
const S_STRING       = 5;  // inside a string body (fast path, no escapes seen yet)
const S_STRING_ESC   = 6;  // just saw \
const S_STRING_UHEX  = 7;  // collecting \uXXXX hex digits
const S_NUMBER       = 8;  // inside a number
const S_KEYWORD      = 9;  // inside true / false / null
const S_ARRAY_FIRST  = 10; // after [ -> expect value or ]
const S_DONE         = 11;

// --- Container kinds ---
const C_OBJ = 1;
const C_ARR = 2;

// --- Byte constants ---
const B_LBRACE   = 0x7B;
const B_RBRACE   = 0x7D;
const B_LBRACKET = 0x5B;
const B_RBRACKET = 0x5D;
const B_QUOTE    = 0x22;
const B_BSLASH   = 0x5C;
const B_COLON    = 0x3A;
const B_COMMA    = 0x2C;
const B_SPACE    = 0x20;
const B_TAB      = 0x09;
const B_LF       = 0x0A;
const B_CR       = 0x0D;
const B_MINUS    = 0x2D;
const B_PLUS     = 0x2B;
const B_DOT      = 0x2E;
const B_E_LO     = 0x65;
const B_E_UP     = 0x45;
const B_T        = 0x74; // t
const B_F        = 0x66; // f
const B_N        = 0x6E; // n
const B_0        = 0x30;
const B_9        = 0x39;
const B_A_UP     = 0x41;
const B_F_UP     = 0x46;
const B_A_LO     = 0x61;
const B_F_LO     = 0x66;

// shared decoder; reused for hot path (non-escaped string slices)
const SHARED_DECODER = new TextDecoder('utf-8');

// Hex digit -> int (returns -1 if invalid)
function hexVal(c) {
  if (c >= B_0 && c <= B_9) return c - B_0;
  if (c >= B_A_LO && c <= B_F_LO) return c - B_A_LO + 10;
  if (c >= B_A_UP && c <= B_F_UP) return c - B_A_UP + 10;
  return -1;
}

export class JSONStreamParser {
  constructor(handlers = {}) {
    this.h = handlers;

    this.state = S_VALUE;

    // container kinds (C_OBJ / C_ARR), top is innermost
    this.stack = [];

    // when entering S_VALUE inside an object after key, the upcoming string is a value, not key
    // when entering S_OBJECT_FIRST / S_OBJECT_KEY, the upcoming string is a key
    this.expectingKey = false;

    // String accumulation:
    //   - fast path: simple ASCII/UTF-8 slice between two `"` with no escapes => single subarray decoded
    //   - slow path (escapes or cross-chunk): build from segments + escape-decoded chars
    this._strSliceStart = -1;          // start index within current chunk if currently scanning a string
    this._strParts = null;             // Array<Uint8Array | string> when string spans chunks or has escapes
    this._strHasEscape = false;

    // Unicode escape collection
    this._uhex = 0;
    this._uhexCount = 0;
    this._pendingHighSurrogate = -1;

    // Number accumulation (always small; just collect as ASCII string)
    this._numStr = '';

    // Keyword accumulation: 'true' | 'false' | 'null'
    this._kwExpected = '';
    this._kwIndex = 0;
    this._kwResult = null;

    this.bytesProcessed = 0;
    this._ended = false;
  }

  // --- public API ---

  write(bytes) {
    if (this._ended) throw new Error('parser already ended');
    if (!bytes || bytes.length === 0) return;
    try {
      this._consume(bytes);
    } catch (e) {
      if (this.h.onError) this.h.onError(e);
      else throw e;
    }
  }

  end() {
    if (this._ended) return;
    this._ended = true;
    try {
      // a number at EOF needs finalization
      if (this.state === S_NUMBER) {
        this._finishNumber();
      }
      if (this.state !== S_DONE) {
        throw new Error('Unexpected end of JSON input (state=' + this.state + ')');
      }
      if (this.h.onEnd) this.h.onEnd();
    } catch (e) {
      if (this.h.onError) this.h.onError(e);
      else throw e;
    }
  }

  // --- internal core loop ---

  _consume(bytes) {
    let i = 0;
    const len = bytes.length;
    this.bytesProcessed += len;

    // If we resumed mid-string, the current chunk continues the string.
    if (this.state === S_STRING) {
      this._strSliceStart = 0;
    }

    outer: while (i < len) {
      const c = bytes[i];

      switch (this.state) {

        case S_VALUE: {
          if (c === B_SPACE || c === B_TAB || c === B_LF || c === B_CR) { i++; break; }
          i = this._dispatchValueStart(bytes, i, c);
          break;
        }

        case S_OBJECT_FIRST: {
          if (c === B_SPACE || c === B_TAB || c === B_LF || c === B_CR) { i++; break; }
          if (c === B_RBRACE) {
            this._closeContainer(C_OBJ);
            i++;
            break;
          }
          if (c === B_QUOTE) {
            this.expectingKey = true;
            this.state = S_STRING;
            this._strSliceStart = i + 1;
            this._strParts = null;
            this._strHasEscape = false;
            i++;
            break;
          }
          throw new Error("Expected string key or '}' at offset " + (this.bytesProcessed - len + i));
        }

        case S_ARRAY_FIRST: {
          if (c === B_SPACE || c === B_TAB || c === B_LF || c === B_CR) { i++; break; }
          if (c === B_RBRACKET) {
            this._closeContainer(C_ARR);
            i++;
            break;
          }
          i = this._dispatchValueStart(bytes, i, c);
          break;
        }

        case S_OBJECT_KEY: {
          if (c === B_SPACE || c === B_TAB || c === B_LF || c === B_CR) { i++; break; }
          if (c === B_QUOTE) {
            this.expectingKey = true;
            this.state = S_STRING;
            this._strSliceStart = i + 1;
            this._strParts = null;
            this._strHasEscape = false;
            i++;
            break;
          }
          throw new Error("Expected string key at offset " + (this.bytesProcessed - len + i));
        }

        case S_AFTER_KEY: {
          if (c === B_SPACE || c === B_TAB || c === B_LF || c === B_CR) { i++; break; }
          if (c === B_COLON) {
            this.state = S_VALUE;
            i++;
            break;
          }
          throw new Error("Expected ':' at offset " + (this.bytesProcessed - len + i));
        }

        case S_AFTER_VALUE: {
          if (c === B_SPACE || c === B_TAB || c === B_LF || c === B_CR) { i++; break; }
          const top = this.stack[this.stack.length - 1];
          if (c === B_COMMA) {
            if (top === C_OBJ) this.state = S_OBJECT_KEY;
            else this.state = S_VALUE;
            i++;
            break;
          }
          if (c === B_RBRACE && top === C_OBJ) { this._closeContainer(C_OBJ); i++; break; }
          if (c === B_RBRACKET && top === C_ARR) { this._closeContainer(C_ARR); i++; break; }
          throw new Error("Expected ',' or close at offset " + (this.bytesProcessed - len + i));
        }

        // ------ STRING fast path ------
        case S_STRING: {
          // scan forward for `"` or `\` (both ASCII; safe with multi-byte UTF-8 continuation bytes >= 0x80)
          while (i < len) {
            const cc = bytes[i];
            if (cc === B_QUOTE) {
              // end of string
              const slice = bytes.subarray(this._strSliceStart, i);
              const str = this._finalizeString(slice);
              this._strSliceStart = -1;
              i++;
              this._emitString(str);
              continue outer;
            }
            if (cc === B_BSLASH) {
              // entering escape; flush bytes seen so far into parts
              this._appendStringSlice(bytes.subarray(this._strSliceStart, i));
              this._strSliceStart = -1;
              this._strHasEscape = true;
              this.state = S_STRING_ESC;
              i++;
              continue outer;
            }
            // disallow raw control chars per JSON spec? Be lenient for performance.
            i++;
          }
          // chunk ended mid-string — save what we have, resume next chunk
          if (this._strSliceStart !== -1) {
            this._appendStringSlice(bytes.subarray(this._strSliceStart));
            this._strSliceStart = -1;
          }
          break outer;
        }

        case S_STRING_ESC: {
          let outChar = '';
          switch (c) {
            case B_QUOTE: outChar = '"'; break;
            case B_BSLASH: outChar = '\\'; break;
            case 0x2F: outChar = '/'; break;       // /
            case 0x62: outChar = '\b'; break;      // b
            case 0x66: outChar = '\f'; break;      // f
            case 0x6E: outChar = '\n'; break;      // n
            case 0x72: outChar = '\r'; break;      // r
            case 0x74: outChar = '\t'; break;      // t
            case 0x75: { // u
              this.state = S_STRING_UHEX;
              this._uhex = 0;
              this._uhexCount = 0;
              i++;
              continue outer;
            }
            default:
              throw new Error('Invalid escape \\' + String.fromCharCode(c));
          }
          this._appendStringPart(outChar);
          this.state = S_STRING;
          this._strSliceStart = i + 1;
          i++;
          break;
        }

        case S_STRING_UHEX: {
          const hv = hexVal(c);
          if (hv < 0) throw new Error('Invalid \\u hex digit');
          this._uhex = (this._uhex << 4) | hv;
          this._uhexCount++;
          i++;
          if (this._uhexCount === 4) {
            const code = this._uhex;
            if (this._pendingHighSurrogate >= 0) {
              if (code >= 0xDC00 && code <= 0xDFFF) {
                const cp = 0x10000 + ((this._pendingHighSurrogate - 0xD800) << 10) + (code - 0xDC00);
                this._appendStringPart(String.fromCodePoint(cp));
              } else {
                // lone high surrogate, emit replacement-ish behavior: encode as is
                this._appendStringPart(String.fromCharCode(this._pendingHighSurrogate));
                this._appendStringPart(String.fromCharCode(code));
              }
              this._pendingHighSurrogate = -1;
            } else if (code >= 0xD800 && code <= 0xDBFF) {
              this._pendingHighSurrogate = code;
            } else {
              this._appendStringPart(String.fromCharCode(code));
            }
            this.state = S_STRING;
            this._strSliceStart = i;
          }
          break;
        }

        // ------ NUMBER ------
        case S_NUMBER: {
          // scan as far as possible without leaving number alphabet
          const start = i;
          while (i < len) {
            const cc = bytes[i];
            if ((cc >= B_0 && cc <= B_9) || cc === B_DOT || cc === B_E_LO || cc === B_E_UP ||
                cc === B_PLUS || cc === B_MINUS) {
              i++;
            } else {
              break;
            }
          }
          if (i > start) this._numStr += SHARED_DECODER.decode(bytes.subarray(start, i));
          if (i === len) break outer; // chunk ended mid-number; resume next chunk
          // number complete
          this._finishNumber();
          break;
        }

        // ------ KEYWORD ------
        case S_KEYWORD: {
          while (i < len && this._kwIndex < this._kwExpected.length) {
            if (bytes[i] !== this._kwExpected.charCodeAt(this._kwIndex)) {
              throw new Error('Invalid literal, expected ' + this._kwExpected);
            }
            i++; this._kwIndex++;
          }
          if (this._kwIndex === this._kwExpected.length) {
            this._emitPrimitive(this._kwResult);
          }
          // else chunk ended mid-keyword; resume next time
          break;
        }

        case S_DONE: {
          if (c === B_SPACE || c === B_TAB || c === B_LF || c === B_CR) { i++; break; }
          throw new Error("Unexpected character after end of JSON: '" + String.fromCharCode(c) + "'");
        }

        default:
          throw new Error('Unknown state ' + this.state);
      }
    }
  }

  // --- helpers ---

  _dispatchValueStart(bytes, i, c) {
    switch (c) {
      case B_LBRACE:
        if (this.h.onStartObject) this.h.onStartObject();
        this.stack.push(C_OBJ);
        this.state = S_OBJECT_FIRST;
        return i + 1;
      case B_LBRACKET:
        if (this.h.onStartArray) this.h.onStartArray();
        this.stack.push(C_ARR);
        this.state = S_ARRAY_FIRST;
        return i + 1;
      case B_QUOTE:
        this.expectingKey = false;
        this.state = S_STRING;
        this._strSliceStart = i + 1;
        this._strParts = null;
        this._strHasEscape = false;
        return i + 1;
      case B_T:
        this._kwExpected = 'true';
        this._kwIndex = 0;
        this._kwResult = true;
        this.state = S_KEYWORD;
        return i;
      case B_F:
        this._kwExpected = 'false';
        this._kwIndex = 0;
        this._kwResult = false;
        this.state = S_KEYWORD;
        return i;
      case B_N:
        this._kwExpected = 'null';
        this._kwIndex = 0;
        this._kwResult = null;
        this.state = S_KEYWORD;
        return i;
      default:
        if (c === B_MINUS || (c >= B_0 && c <= B_9)) {
          this._numStr = '';
          this.state = S_NUMBER;
          return i;
        }
        throw new Error("Unexpected character '" + String.fromCharCode(c) + "' at offset " + (this.bytesProcessed - bytes.length + i));
    }
  }

  _closeContainer(kind) {
    const top = this.stack.pop();
    if (top !== kind) throw new Error('Mismatched container close');
    if (kind === C_OBJ) {
      if (this.h.onEndObject) this.h.onEndObject();
    } else {
      if (this.h.onEndArray) this.h.onEndArray();
    }
    this._afterValueTransition();
  }

  _afterValueTransition() {
    if (this.stack.length === 0) {
      this.state = S_DONE;
    } else {
      this.state = S_AFTER_VALUE;
    }
  }

  _finishNumber() {
    const s = this._numStr;
    this._numStr = '';
    if (s.length === 0) throw new Error('Empty number');
    // Number() handles ints, floats, exponents, leading minus.
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error('Invalid number: ' + s);
    this._emitPrimitive(n);
  }

  _emitString(str) {
    if (this.expectingKey) {
      this.expectingKey = false;
      if (this.h.onKey) this.h.onKey(str);
      this.state = S_AFTER_KEY;
    } else {
      if (this.h.onValue) this.h.onValue(str);
      this._afterValueTransition();
    }
  }

  _emitPrimitive(v) {
    if (this.h.onValue) this.h.onValue(v);
    this._afterValueTransition();
  }

  // --- string assembly ---

  _appendStringSlice(uint8Slice) {
    if (uint8Slice.length === 0) return;
    if (this._strParts === null) this._strParts = [];
    this._strParts.push(uint8Slice);
  }

  _appendStringPart(str) {
    if (this._strParts === null) this._strParts = [];
    this._strParts.push(str);
  }

  // Called when we hit the closing `"`. `tailSlice` is the final raw byte slice (may be empty).
  _finalizeString(tailSlice) {
    // Fast path: no escapes, no prior parts -> decode the slice in one go.
    if (this._strParts === null && !this._strHasEscape) {
      if (tailSlice.length === 0) return '';
      return SHARED_DECODER.decode(tailSlice);
    }
    // Slow path: assemble pieces.
    if (tailSlice.length > 0) this._appendStringSlice(tailSlice);
    let out = '';
    const parts = this._strParts;
    // Concatenate consecutive Uint8Array parts before decoding to keep multi-byte UTF-8 sequences intact.
    let bufRun = null;
    let bufRunLen = 0;
    const flushBufRun = () => {
      if (!bufRun) return;
      if (bufRun.length === 1) {
        out += SHARED_DECODER.decode(bufRun[0]);
      } else {
        const merged = new Uint8Array(bufRunLen);
        let off = 0;
        for (const b of bufRun) { merged.set(b, off); off += b.length; }
        out += SHARED_DECODER.decode(merged);
      }
      bufRun = null;
      bufRunLen = 0;
    };
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (typeof p === 'string') {
        flushBufRun();
        out += p;
      } else {
        if (!bufRun) bufRun = [];
        bufRun.push(p);
        bufRunLen += p.length;
      }
    }
    flushBufRun();
    this._strParts = null;
    this._strHasEscape = false;
    return out;
  }
}

export default JSONStreamParser;
