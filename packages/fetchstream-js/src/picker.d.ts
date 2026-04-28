// Type definitions for `fetchstream-js/picker`
//
// Picker layer: tracks the current path inside the JSON document and
// materializes only the subtrees that match a subscription.

import {
  JSONValue,
  PathStack,
  MatchCallback,
  ProgressCallback,
} from './index';
import { ParserHandlers } from './parser';

export type AnyListener = (eventName: string, ...args: unknown[]) => void;

export class StreamPicker {
  constructor();

  /** Fires ONCE per match, after the whole value at `path` has been parsed. */
  on<T = JSONValue>(path: string, callback: MatchCallback<T>): this;

  /**
   * Fires REPEATEDLY as the value at `path` grows. The callback receives the
   * same mutable reference each time -- the value grows in place.
   */
  onProgress<T = JSONValue>(path: string, callback: ProgressCallback<T>): this;

  /** Sugar for `onProgress('$', cb)` -- a live mirror of the whole document. */
  live<T = JSONValue>(callback: ProgressCallback<T>): this;

  /** Raw SAX listener: `fn(eventName, ...args)`. */
  onAny(fn: AnyListener): this;

  /** Returns parser handlers wired to this picker. Pass them to a `JSONStreamParser`. */
  handlers(): ParserHandlers;

  /** Current partial (or final) live root. */
  readonly snapshot: JSONValue | undefined;
}

export default StreamPicker;
