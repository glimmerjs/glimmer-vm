import type { RichIteratorResult } from '../core';
import type { Bounds, DOMEnvironment } from '../dom/bounds';
import type { BlockBoundsRef } from '../dom/tree-builder';
import type { Environment } from './environment';

export interface ExceptionHandler {
  handleException(): void;
}

export interface RenderResult<E extends DOMEnvironment = DOMEnvironment>
  extends Bounds<E>,
    ExceptionHandler {
  readonly environment: Environment;
  readonly _blockBounds_: BlockBoundsRef;
  _link_(parent: object): void;

  rerender(options?: { alwaysRevalidate?: boolean | false }): void;

  parentElement(): E['element'];

  firstNode(): E['child'];
  lastNode(): E['child'];
}

export interface TemplateIterator {
  next(): RichIteratorResult<null, RenderResult>;
  sync(): RenderResult;
}
