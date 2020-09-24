import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import type { Source, SourcePosition } from '../-internal';
import {
  _BROKEN,
  AbstractSourceOffset,
  AbstractSourceSpan,
  BROKEN,
  CharOffset,
  CharOffsetSpan,
  charSpan,
  collapsed,
  InvisibleOffset,
  LocationOffset,
  LocationSpan as LazySpan,
  SourceOffset,
  SourceSpan,
} from './-internal';

export abstract class AbstractVisibleSourceSpan extends AbstractSourceSpan {
  constructor(readonly src: Source) {
    super();
  }

  withEnd(other: SourceOffset): SourceSpan {
    return new LazySpan(this.src, {
      start: this.startPosition,
      end: other.pos,
    });
  }
}

export type VisibleSpan = CharOffsetSpan | LazySpan;

export abstract class AbstractVisibleSourceOffset extends AbstractSourceOffset {
  constructor(readonly src: Source) {
    super();
  }

  eql(other: SourceOffset): boolean {
    if (other instanceof AbstractVisibleSourceOffset) {
      if (this.hasCharOffset && other.hasCharOffset) {
        return this.charOffset === other.charOffset;
      } else {
        return this.pos === other.pos;
      }
    } else {
      return false;
    }
  }

  /**
   * The byte offset for the current `SourceOffset`. In the case of `LocationOffset`, the char
   * offset is computed the first time it's requested.
   */
  abstract get charOffset(): number;

  collapsed(): CharOffsetSpan | LazySpan {
    if (this.hasCharOffset()) {
      return collapsed(this.src, this.charOffset);
    } else {
      return new LazySpan(this.src, {
        start: this.pos,
        end: this.pos,
      });
    }
  }

  /**
   * Moving a SourceOffset always requires eagerly getting its `CharOffset`.
   */
  move(by: number): CharOffset | InvisibleOffset {
    let target = this.charOffset + by;

    if (target < 0) {
      return InvisibleOffset.broken(1, target);
    } else if (target > this.src.source.length) {
      return InvisibleOffset.broken(1, target);
    }

    return new CharOffset(this.src, target);
  }

  withEnd(end: SourceOffset): SourceSpan {
    if (end instanceof AbstractVisibleSourceOffset) {
      if (this.hasCharOffset && end.hasCharOffset) {
        return charSpan(this.src, this.charOffset, end.charOffset);
      } else {
        return new LazySpan(this.src, {
          start: this.pos,
          end: end.pos,
        });
      }
    } else {
      if (LOCAL_DEBUG) {
        return BROKEN(
          `Extending a ${this.constructor.name} with an invisible source offset is not advisable`
        );
      } else {
        return _BROKEN;
      }
    }
  }

  toJSON(): SourcePosition {
    return this.pos;
  }
}

export type VisibleSourceOffset = CharOffset | LocationOffset;
