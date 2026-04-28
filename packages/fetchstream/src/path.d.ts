// Type definitions for `fetchstream/path`
//
// Path compiler/matcher for the JSONPath-lite syntax used by fetchstream.
//
// Supported syntax:
//   $              -> root value
//   $.key          -> child key
//   $.key.sub      -> chained child keys
//   $.key.*        -> any object key or any array element at that level
//   $.key[*]       -> same as .*
//   $.key[0]       -> specific array index
//   $.key["weird name"] -> bracket-quoted key

import { PathStack } from './index';

export const SEG_KEY: 1;
export const SEG_INDEX: 2;
export const SEG_WILD: 3;

export type PathSegment =
  | { type: typeof SEG_KEY; value: string }
  | { type: typeof SEG_INDEX; value: number }
  | { type: typeof SEG_WILD };

/** Compile a path string into segment tokens. */
export function compilePath(path: string): PathSegment[];

/** Returns true iff `segments` exactly match `pathStack`. */
export function matches(segments: PathSegment[], pathStack: PathStack): boolean;

/**
 * Returns true iff `segments[0..pathStack.length-1]` matches `pathStack` --
 * i.e. it's still possible that going deeper could match this subscription.
 */
export function prefixMatches(segments: PathSegment[], pathStack: PathStack): boolean;

/** Render a path stack as a JSONPath-lite string. */
export function pathToString(pathStack: PathStack): string;
