// eslint-disable-next-line import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';
import { SourceSlice } from '../slice';
import type { SourceLocation, SourcePosition } from '../location';
import type { SerializedSourceOffsets } from '../offsets';
import type { ConcreteSourceOffset, ConcreteSourceOffsets } from './concrete';
import type { InvisibleSourceOffset, InvisibleSourceOffsets } from './invisible';
import type { LazySourceOffset, LazySourceOffsets } from './lazy';
import { Source } from '../source';

export type EagerSourceOffsets = ConcreteSourceOffsets | InvisibleSourceOffsets;
export type SourceOffsets = EagerSourceOffsets | LazySourceOffsets;

export type SourceOffset = ConcreteSourceOffset | InvisibleSourceOffset | LazySourceOffset;

export const enum SourceOffsetKind {
  Normal = 'NORMAL',
  Collapsed = 'COLLAPSED',
  /**
   * for (rare) situations where a node is created but there was no source location (e.g. the name
   * "default" in default blocks when the word "default" never appeared in source). This is used
   * by the internals when there is a legitimate reason for the internals to synthesize a node
   * with no location.
   */
  InternalsSynthetic = 'InternalsSynthetic',
  /**
   * For situations where a node represents zero parts of the source (for example, empty arguments).
   * In general, we attempt to assign these nodes *some* position (empty arguments can be
   * positioned immediately after the callee), but it's not always possible
   */
  NonExistent = 'NON_EXISTENT',
  /**
   * For situations where a source location was expected, but it didn't correspond to the node in
   * the source. This happens if a plugin creates broken locations.
   */
  Broken = 'BROKEN',
  Lazy = 'LAZY',
}

/**
 * All SourceOffsets objects implement `SourceLocation`, for compatibility. All SourceOffsets
 * objects have a `toJSON` that emits `SourceLocation`, also for compatibility.
 *
 * The goal is to avoid creating any problems for use-cases like AST Explorer.
 */
export abstract class AbstractSourceOffsets<K extends SourceOffsetKind = SourceOffsetKind>
  implements SourceLocation {
  #location: SourceLocation | null = null;

  constructor(readonly kind: K) {}

  abstract toLoc(): SourceLocation;

  get loc(): SourceLocation {
    if (!this.#location) {
      this.#location = this.toLoc();
    }

    return this.#location;
  }

  get start(): SourcePosition {
    return this.loc.start;
  }

  get end(): SourcePosition {
    return this.loc.end;
  }

  abstract get startOffset(): SourceOffset;
  abstract get endOffset(): SourceOffset;

  abstract extend(other: SourceOffsets): SourceOffsets;

  abstract collapse(where: 'start' | 'end'): SourceOffsets;

  abstract asString(): string;

  abstract sliceRange(options: { skipStart: number; skipEnd?: number }): SourceOffsets;
  abstract sliceRange(options: { skipStart: number; chars: number }): SourceOffsets;
  abstract sliceRange(options: { skipEnd: number; chars: number }): SourceOffsets;
  abstract sliceRange(
    options:
      | { skipStart: number; skipEnd?: number }
      | { skipStart: number; chars: number }
      | { skipEnd: number; chars: number }
  ): SourceOffsets;

  abstract serialize(): SerializedSourceOffsets;

  toJSON(): SourceLocation {
    return this.loc;
  }

  withEnd(other: SourceOffset): SourceOffsets {
    return this.extend(other.collapsed());
  }

  collapseStart(): SourceOffsets {
    return this.collapse('start');
  }

  collapseEnd(): SourceOffsets {
    return this.collapse('end');
  }

  toSlice(this: SourceOffsets, expected?: string): SourceSlice {
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

  slice({ skipStart = 0, skipEnd = 0 }: { skipStart?: number; skipEnd?: number }): SourceOffsets {
    return this.sliceRange({ skipStart, skipEnd });
  }

  sliceStart({ chars, from = 0 }: { chars: number; from?: number }): SourceOffsets {
    return this.sliceRange({ skipStart: from, chars });
  }

  sliceFrom({ from }: { from: number }): SourceOffsets {
    return this.sliceRange({ skipStart: from, skipEnd: 0 });
  }

  sliceTo({ skipEnd = 0, chars = 0 }: { skipEnd?: number; chars?: number }): SourceOffsets {
    return this.sliceRange({ skipEnd, chars });
  }
}

export abstract class AbstractSourceOffset {
  abstract eql(other: SourceOffset): boolean;
  abstract toPos(): SourcePosition;

  #pos: SourcePosition | null = null;

  get pos(): SourcePosition {
    if (!this.#pos) {
      this.#pos = this.toPos();
    }

    return this.#pos;
  }
}
