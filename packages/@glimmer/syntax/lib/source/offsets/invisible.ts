import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { unreachable } from '@glimmer/util';

import {
  NON_EXISTENT_LOCATION,
  SourceLocation,
  SourcePosition,
  SYNTHETIC_LOCATION,
} from '../location';
import type { SerializedSourceSpan } from '../spans';
import type { SourceOffset, SourceSpan } from './-internal';
import { AbstractSourceOffset as AbstractOffset, AbstractSourceSpan } from './-internal';

export const enum InvisibleKind {
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
}

/**
 * This class represents source offsets that aren't present in source. In the future, we could add
 * warnings here for SourceOffsetKind.Broken to help detect broken AST plugins.
 */
export class InvisibleSpan extends AbstractSourceSpan implements SourceLocation {
  static synthetic(source: string): InvisibleSpan {
    return new InvisibleSpan(InvisibleKind.InternalsSynthetic, source);
  }

  readonly isVisible = false;

  constructor(readonly kind: InvisibleKind, private string: string | null = null) {
    super();
  }

  protected locDidUpdate({ start }: { start?: SourcePosition; end?: SourcePosition }): void {
    if (LOCAL_DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(`attempted to update the ${start ? 'start' : 'end'} of an invisible SourceSpan`);
    }
  }

  protected toLoc(): SourceLocation {
    if (this.kind === InvisibleKind.Broken) {
      return SYNTHETIC_LOCATION;
    } else {
      return NON_EXISTENT_LOCATION;
    }
  }

  get startOffset(): InvisibleOffset {
    return new InvisibleOffset(this.startPosition.line, this.startPosition.column, this.kind);
  }

  get endOffset(): InvisibleOffset {
    return new InvisibleOffset(this.endPosition.line, this.endPosition.column, this.kind);
  }

  asString(): string {
    if (this.string) {
      return this.string;
    }

    throw new Error(
      `unexpectedly attemped to convert a source offset with no string representation into a string`
    );
  }

  collapse(): SourceSpan {
    if (this.string) {
      return new InvisibleSpan(this.kind);
    } else {
      return this;
    }
  }

  slice(): SourceSpan {
    if (this.string) {
      throw new Error(`unexpectedly attempted to slice an out-of-source string`);
    }

    return this;
  }

  sliceStartChars(): SourceSpan {
    if (this.string) {
      throw new Error(`unexpectedly attempted to slice an out-of-source string`);
    }

    return this;
  }

  sliceEndChars(): SourceSpan {
    if (this.string) {
      throw new Error(`unexpectedly attempted to slice an out-of-source string`);
    }

    return this;
  }

  extend(_other: SourceSpan): InvisibleSpan {
    if (LOCAL_DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(`trying to extend an invisible offset is not advisable`);
    }

    return new InvisibleSpan(this.kind);
  }

  serialize(): SerializedSourceSpan {
    const kind: InvisibleKind = this.kind;
    if (kind === InvisibleKind.InternalsSynthetic) {
      if (this.string) {
        return [this.string];
      } else {
        throw unreachable(`synthetic strings must have a string representation`);
      }
    }

    return kind;
  }
}

export const NON_EXISTENT: SourceSpan = new InvisibleSpan(InvisibleKind.NonExistent);

type BrokenSourceOffsets = InvisibleSpan;

export const _BROKEN: BrokenSourceOffsets = new InvisibleSpan(InvisibleKind.Broken);

export function BROKEN(message?: string): BrokenSourceOffsets {
  if (LOCAL_DEBUG && message) {
    // eslint-disable-next-line no-console
    console.warn(message);
    throw new Error('TODO: remove');
  }

  return _BROKEN;
}

export function isInvisible(offsets: SourceSpan): offsets is InvisibleSpan {
  return offsets instanceof InvisibleSpan;
}

export class InvisibleOffset extends AbstractOffset {
  static broken(line: number, column: number): InvisibleOffset {
    return new InvisibleOffset(line, column, InvisibleKind.Broken);
  }

  static nonexistent(line: number, column: number): InvisibleOffset {
    return new InvisibleOffset(line, column, InvisibleKind.NonExistent);
  }

  readonly isVisible = false;
  private sourcePosition: SourcePosition;

  constructor(
    readonly line: number,
    readonly column: number,
    readonly kind: InvisibleKind | InvisibleKind.InternalsSynthetic
  ) {
    super();
    this.sourcePosition = { line, column };
  }

  hasCharOffset(): false {
    return false;
  }

  get currentCharOffset(): null {
    return null;
  }

  get charOffset(): null {
    return null;
  }

  eql(other: SourceOffset): boolean {
    if (other instanceof InvisibleOffset) {
      return this.line === other.line && this.column === other.column && this.kind === other.kind;
    }

    return false;
  }

  collapsed(): InvisibleSpan {
    if (this.kind === InvisibleKind.InternalsSynthetic) {
      return InvisibleSpan.synthetic('');
    } else {
      return new InvisibleSpan(this.kind);
    }
  }

  move(_by: number): SourceOffset {
    return new InvisibleOffset(this.line, this.column, this.kind);
  }

  protected toPos(): SourcePosition {
    return this.sourcePosition;
  }

  withEnd(_end: SourceOffset): SourceSpan {
    if (LOCAL_DEBUG) {
      return BROKEN(`The source location ${this.line}:${this.column} didn't exist in the source`);
    } else {
      return _BROKEN;
    }
  }

  toJSON(): SourcePosition {
    return this.pos;
  }
}
