// Type definitions for `fetchstream/parser`
//
// Low-level SAX-style streaming JSON parser. No path matching, no value
// materialization beyond primitives.

export interface ParserHandlers {
  onStartObject?: () => void;
  onEndObject?: () => void;
  onStartArray?: () => void;
  onEndArray?: () => void;
  /** Object key (always a string). */
  onKey?: (key: string) => void;
  /** Primitive value: string, number, boolean, or null. */
  onValue?: (value: string | number | boolean | null) => void;
  /** Called when the document is fully parsed. */
  onEnd?: () => void;
  /**
   * Called on parse errors. If omitted, errors are thrown synchronously
   * from `write()` / `end()`.
   */
  onError?: (err: Error) => void;
}

export class JSONStreamParser {
  constructor(handlers?: ParserHandlers);

  /** Total number of bytes ever passed to `write()`. */
  bytesProcessed: number;

  /** Push more bytes. Throws if the parser has already ended. */
  write(bytes: Uint8Array): void;

  /** Finalize. Calls `onEnd()` (or `onError()` if the document was incomplete). */
  end(): void;
}

export default JSONStreamParser;
