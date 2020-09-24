// eslint-disable-next-line import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';

import type { SerializedSourceSpan, Source } from '../-internal';
import { SourceSlice } from '../-internal';
import type { SourceLocation, SourcePosition } from '../location';
import type {
  CharOffsetSpan,
  InvisibleOffset,
  InvisibleSpan,
  LocationSpan,
  VisibleSourceOffset,
} from './-internal';

export type EagerSpan = CharOffsetSpan | InvisibleSpan;
export type SourceSpan = EagerSpan | LocationSpan;

export type SourceOffset = VisibleSourceOffset | InvisibleOffset;

export function isSourceSpan(v: object): v is SourceSpan {
  return v instanceof AbstractSourceSpan;
}

/**
 * A `SourceSpan` object represents a span of characters inside of a template source.
 *
 * There are three kinds of `SourceSpan` objects:
 *
 * - `ConcreteSourceSpan`, which contains byte offsets
 * - `LazySourceSpan`, which contains `SourceLocation`s from the Handlebars AST, which can be
 *   converted to byte offsets on demand.
 * - `InvisibleSourceSpan`, which represent source strings that aren't present in the source,
 *   because:
 *     - they were created synthetically
 *     - their location is nonsensical (the span is broken)
 *     - they represent nothing in the source (this currently happens only when a bug in the
 *       upstream Handlebars parser fails to assign a location to empty blocks)
 *
 * At a high level, all `SourceSpan` objects provide:
 *
 * - byte offsets
 * - source positions in column and line format
 *
 * And you can do these operations on `SourceSpan`s:
 *
 * - collapse it to a `SourceSpan` representing its starting or ending position
 * - slice out some characters, optionally skipping some characters at the beginning or end
 * - create a new `SourceSpan` with a different starting or ending offset
 *
 * All SourceSpan objects implement `SourceLocation`, for compatibility. All SourceSpan
 * objects have a `toJSON` that emits `SourceLocation`, also for compatibility.
 *
 * For compatibility, subclasses of `AbstractSourceSpan` must implement `locDidUpdate`, which
 * happens when an AST plugin attempts to modify the `start` or `end` of a span directly.
 *
 * The goal is to avoid creating any problems for use-cases like AST Explorer.
 */
export abstract class AbstractSourceSpan implements SourceLocation {
  #location: SourceLocation | null = null;

  /**
   * Represents a span that is present in the source. This also means that the span has a
   * `src: Source` field.
   */
  abstract readonly isVisible: boolean;

  hasByteOffsets(): this is {
    startOffset: { currentCharOffset: number };
    endOffset: { currentCharOffset: number };
  } {
    return this.startOffset.hasCharOffset() && this.endOffset.hasCharOffset();
  }

  /**
   * Convert this SourceSpan into a SourceLocation object. This method is called once the first
   * time it's needed and its return value is cached.
   *
   * SourceSpans that already have locations can just return the locations they have, while
   * SourceSpans that represent offsets should compute the location when asked.
   *
   * In general, consumers of SourceSpan should attempt to use byte offsets as much as possible for
   * math to avoid unnecessary conversions.
   */
  protected abstract toLoc(): SourceLocation;

  /**
   * Support legacy changes to `start` and `end` in the location
   */
  protected abstract locDidUpdate(loc: { start?: SourcePosition; end?: SourcePosition }): void;

  /**
   * Lazily compute the `SourceLocation` for this `SourceSpan`.
   */
  private get loc(): SourceLocation {
    if (!this.#location) {
      this.#location = this.toLoc();
    }

    return this.#location;
  }

  /**
   * Get the starting `SourcePosition` for this `SourceSpan`, lazily computing it if needed.
   */
  get startPosition(): SourcePosition {
    return this.loc.start;
  }

  /**
   * Get the ending `SourcePosition` for this `SourceSpan`, lazily computing it if needed.
   */
  get endPosition(): SourcePosition {
    return this.loc.end;
  }

  /**
   * Get the starting `SourceOffset` for this `SourceSpan`. If the `SourceSpan` is lazy, this will
   * return a `LocationOffset`.
   */
  abstract get startOffset(): SourceOffset;

  /**
   * Get the ending `SourceOffset` for this `SourceSpan`. If the `SourceSpan` is lazy, this will
   * return a `LocationOffset`.
   */
  abstract get endOffset(): SourceOffset;

  /**
   * Collapse this `SourceSpan` into a `SourceSpan` representing one position in the source (either
   * `'start'` or `'end'`).
   */
  abstract collapse(where: 'start' | 'end'): SourceSpan;

  /**
   * Convert this `SourceSpan` into the string that it represents.
   *
   * If the `SourceSpan` represents a synthetic node, it remembers the string it was created for.
   * Otherwise, the `SourceSpan` attempts to slice characters out of the source string.
   */
  abstract asString(): string;

  /**
   * Slice the current span, optionally skipping characters at the beginning or end.
   */
  abstract slice(options: { skipStart?: number; skipEnd?: number }): SourceSpan;

  /**
   * Slice a number of characters from the beginning of the current span, optionally skipping
   * characters. If you want to slice from the end, use `sliceEndChars` instead.
   */
  abstract sliceStartChars(options: { skipStart?: number; chars: number }): SourceSpan;

  /**
   * Slice a number of characters from the end of the current span, optionally skipping characters.
   * If you want to slice from the beginning, use `sliceStartChars` instead.
   */
  abstract sliceEndChars(options: { skipEnd?: number; chars: number }): SourceSpan;

  /**
   * Turn this `SourceSpan` into a data format appropriate for uses like AST Explorer.
   */
  abstract serialize(): SerializedSourceSpan;

  abstract extend(this: SourceSpan, other: SourceSpan): SourceSpan;

  /**
   * Support converting ASTv1 nodes into a serialized format using JSON.stringify.
   */
  toJSON(): SourceLocation {
    return this.loc;
  }

  /**
   * Create a new span with the current span's end and a new beginning.
   */
  withStart(other: SourceOffset): SourceSpan {
    return other.withEnd(this.endOffset);
  }

  /**
   * Create a new span with the current span's beginning and a new ending.
   */
  withEnd(this: SourceSpan, other: SourceOffset): SourceSpan {
    return this.extend(other.collapsed());
  }

  /**
   * Convert this `SourceSpan` into a `SourceSlice`. In debug mode, this method optionally checks
   * that the byte offsets represented by this `SourceSpan` actually correspond to the expected
   * string.
   */
  toSlice(this: SourceSpan, expected?: string): SourceSlice {
    let chars = this.asString();

    if (DEBUG) {
      if (expected !== undefined && chars !== expected) {
        throw new Error(
          `unexpectedly found ${JSON.stringify(
            chars
          )} when slicing source, but expected ${JSON.stringify(expected)}`
        );
      }
    }

    return new SourceSlice({
      loc: this,
      chars: this.asString(),
    });
  }

  /**
   * For compatibility with SourceLocation in AST plugins
   *
   * @deprecated use startPosition instead */
  get start(): SourcePosition {
    return this.loc.start;
  }

  /**
   * For compatibility with SourceLocation in AST plugins
   *
   * @deprecated use withStart instead
   */
  set start(position: SourcePosition) {
    this.loc.start = position;
    this.locDidUpdate({ start: position });
  }

  /**
   * For compatibility with SourceLocation in AST plugins
   *
   * @deprecated use endPosition instead
   */
  get end(): SourcePosition {
    return this.loc.end;
  }

  /**
   * For compatibility with SourceLocation in AST plugins
   *
   * @deprecated use withEnd instead
   */
  set end(position: SourcePosition) {
    this.loc.end = position;
    this.locDidUpdate({ end: position });
  }
}

/**
 * A `SourceOffset` represents a single position in the source.
 *
 * There are two kinds of `SourceSpan` objects:
 *
 * - `CharOffset`, which contains a character offset
 * - `LocationOffset`, which contains a `SourcePosition` from the Handlebars AST, which can be
 *   converted to a character offset on demand.
 * - `InvisibleOffset`, which represents a position not in source (@see {AbstractSourceOffsets})
 *
 * At a high level, all `SourceSpan` objects provide:
 *
 * - a character offsets
 * - a source position in column and line format
 */
export abstract class AbstractSourceOffset {
  abstract eql(other: SourceOffset): boolean;

  /**
   * Represents an offset that is present in the source. This also means that the offset has a
   * `src: Source` field.
   */
  abstract readonly isVisible: boolean;

  protected abstract toPos(): SourcePosition;

  /**
   * Whether the object has a char offset immediately available. This is useful in cases where you
   * may have other ways to accomplish the same goal (e.g. comparing two lazy spans) without
   * computing the char offset from its column and line number.
   *
   * Whenever a SourceOffset has a char offset, it must also have a `src` property with a `Source`.
   */
  abstract hasCharOffset(): this is { src: Source; currentCharOffset: number };

  /**
   * When `hasByteOffset` returns true, `currentCharOffset` returns a number. This makes it
   * possible to get the byte offset if it's already computed without risking computing the byte
   * offset if it doesn't.
   */
  abstract get currentCharOffset(): number | null;

  #pos: SourcePosition | null = null;

  get pos(): SourcePosition {
    if (!this.#pos) {
      this.#pos = this.toPos();
    }

    return this.#pos;
  }
}
