import * as hbs from '../../types/handlebars-ast';
import { UNMATCHED } from './core';

export class Frame {
  private spans: hbs.Span[] = [];
  private marked = false;

  constructor(private defaultPos: number) {}

  addToken(span: hbs.Span): void {
    if (this.marked) {
      throw new Error(`Can't parse while applying span to final parsed syntax`);
    }

    this.spans.push(span);
  }

  addThunk<T>({ span, value }: { span: hbs.Span; value: ((span: hbs.Span) => T) }): T;
  addThunk<T>({
    span,
    value,
  }: {
    span: hbs.Span;
    value: ((span: hbs.Span) => T) | UNMATCHED;
  }): T | UNMATCHED;
  addThunk<T>({
    span,
    value,
  }: {
    span: hbs.Span;
    value: ((span: hbs.Span) => T) | UNMATCHED;
  }): T | UNMATCHED {
    if (this.marked) {
      throw new Error(`Can't parse while applying span to final parsed syntax`);
    }

    this.mark();
    let out = value === UNMATCHED ? UNMATCHED : value(span);
    this.unmark();

    this.spans.push(span);

    return out;
  }

  maybeAddThunk<T>(span: hbs.Span | null, thunk: (span: hbs.Span | null) => T): T {
    if (this.marked) {
      throw new Error(`Can't parse while applying span to final parsed syntax`);
    }

    this.mark();
    let out = thunk(span);
    this.unmark();

    if (span) {
      this.spans.push(span);
    }

    return out;
  }

  mark(): void {
    this.marked = true;
  }

  unmark(): void {
    this.marked = false;
  }

  skipTo(pos: number): void {
    this.defaultPos = pos;
  }

  finalize(): hbs.Span {
    if (this.spans.length === 0) {
      return { start: this.defaultPos, end: this.defaultPos };
    }

    let first = this.spans[0];
    let last = this.spans[this.spans.length - 1];

    return { start: first.start, end: last.end };
  }
}
