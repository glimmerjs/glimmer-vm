import { Source } from '../source';
import { AbstractSourceOffsets, SourceOffset, SourceOffsetKind, SourceOffsets } from './abstract';
import { LazySourceOffsets } from './lazy';

export abstract class VisibleSourceOffsets<
  K extends SourceOffsetKind = SourceOffsetKind
> extends AbstractSourceOffsets<K> {
  constructor(kind: K, readonly src: Source) {
    super(kind);
  }

  withEnd(other: SourceOffset): SourceOffsets {
    return new LazySourceOffsets(this.src, {
      start: this.loc.start,
      end: other.pos,
    });
  }
}
