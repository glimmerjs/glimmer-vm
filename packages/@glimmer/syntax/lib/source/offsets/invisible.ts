import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { unreachable } from '@glimmer/util';
import {
  NON_EXISTENT_LOCATION,
  SourceLocation,
  SourcePosition,
  SYNTHETIC_LOCATION,
} from '../location';
import type { SerializedSourceOffsets } from '../offsets';
import type { SourceOffset, SourceOffsets } from './abstract';
import { AbstractSourceOffset, AbstractSourceOffsets, SourceOffsetKind } from './abstract';

export type InvisibleSourceOffsetKind =
  | SourceOffsetKind.NonExistent
  | SourceOffsetKind.Broken
  | SourceOffsetKind.InternalsSynthetic;

/**
 * This class represents source offsets that aren't present in source. In the future, we could add
 * warnings here for SourceOffsetKind.Broken to help detect broken AST plugins.
 */
export class InvisibleSourceOffsets<K extends InvisibleSourceOffsetKind = InvisibleSourceOffsetKind>
  extends AbstractSourceOffsets<K>
  implements SourceLocation {
  static synthetic(source: string): InvisibleSourceOffsets<SourceOffsetKind.InternalsSynthetic> {
    return new InvisibleSourceOffsets(SourceOffsetKind.InternalsSynthetic, source);
  }

  constructor(readonly kind: K, private string: string | null = null) {
    super(kind);
  }

  toLoc(): SourceLocation {
    if (this.kind === SourceOffsetKind.Broken) {
      return SYNTHETIC_LOCATION;
    } else {
      return NON_EXISTENT_LOCATION;
    }
  }

  get startOffset(): InvisibleSourceOffset {
    return new InvisibleSourceOffset(this.start.line, this.start.column, this.kind);
  }

  get endOffset(): InvisibleSourceOffset {
    return new InvisibleSourceOffset(this.end.line, this.end.column, this.kind);
  }

  asString(): string {
    if (this.string) {
      return this.string;
    }

    throw new Error(
      `unexpectedly attemped to convert a source offset with no string representation into a string`
    );
  }

  collapse(): SourceOffsets {
    if (this.string) {
      return new InvisibleSourceOffsets(this.kind);
    } else {
      return this;
    }
  }

  sliceRange(): InvisibleSourceOffsets<K> {
    if (this.string) {
      throw new Error(`unexpectedly attempted to slice an out-of-source string`);
    }

    return this;
  }

  extend(_other: SourceOffsets): InvisibleSourceOffsets<K> {
    if (LOCAL_DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(`trying to extend an invisible offset is not advisable`);
    }

    return new InvisibleSourceOffsets(this.kind);
  }

  serialize(): SerializedSourceOffsets {
    const kind: InvisibleSourceOffsetKind = this.kind;
    if (kind === SourceOffsetKind.InternalsSynthetic) {
      if (this.string) {
        return [this.string];
      } else {
        throw unreachable(`synthetic strings must have a string representation`);
      }
    }

    return kind;
  }
}

export const NON_EXISTENT: SourceOffsets = new InvisibleSourceOffsets(SourceOffsetKind.NonExistent);

type BrokenSourceOffsets = InvisibleSourceOffsets<SourceOffsetKind.Broken>;

export const _BROKEN: BrokenSourceOffsets = new InvisibleSourceOffsets(SourceOffsetKind.Broken);

export function BROKEN(message?: string): BrokenSourceOffsets {
  if (LOCAL_DEBUG && message) {
    // eslint-disable-next-line no-console
    console.warn(message);
    throw new Error('TODO: remove');
  }

  return _BROKEN;
}
export type ConcreteSourceOffsetKind = SourceOffsetKind.Normal | SourceOffsetKind.Collapsed;

export function isInvisible(offsets: SourceOffsets): offsets is InvisibleSourceOffsets {
  return offsets.kind === SourceOffsetKind.Broken || offsets.kind === SourceOffsetKind.NonExistent;
}

export class InvisibleSourceOffset extends AbstractSourceOffset {
  static broken(line: number, column: number) {
    return new InvisibleSourceOffset(line, column, SourceOffsetKind.Broken);
  }

  static nonexistent(line: number, column: number) {
    return new InvisibleSourceOffset(line, column, SourceOffsetKind.NonExistent);
  }

  private sourcePosition: SourcePosition;

  constructor(
    readonly line: number,
    readonly column: number,
    readonly kind: InvisibleSourceOffsetKind | SourceOffsetKind.InternalsSynthetic
  ) {
    super();
    this.sourcePosition = { line, column };
  }

  get offset(): null {
    return null;
  }

  eql(other: SourceOffset): boolean {
    if (other instanceof InvisibleSourceOffset) {
      return this.line === other.line && this.column === other.column && this.kind === other.kind;
    }

    return false;
  }

  collapsed(): SourceOffsets {
    if (this.kind === SourceOffsetKind.InternalsSynthetic) {
      return InvisibleSourceOffsets.synthetic('');
    } else {
      return new InvisibleSourceOffsets(this.kind);
    }
  }

  move(_by: number): SourceOffset {
    return new InvisibleSourceOffset(this.line, this.column, this.kind);
  }

  toPos(): SourcePosition {
    return this.sourcePosition;
  }

  withEnd(_end: SourceOffset): SourceOffsets {
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
