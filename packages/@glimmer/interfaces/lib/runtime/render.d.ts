import type { SimpleElement, SimpleNode } from '@simple-dom/interface';

import type { RichIteratorResult } from '../core';
import type { Bounds } from '../dom/bounds';
import type { Environment } from './environment';

export interface ExceptionHandler {
  handleException(): void;
}

export interface RenderResult extends Bounds, ExceptionHandler {
  readonly env: Environment;
  _link_(parent: object): void;

  rerender(options?: { alwaysRevalidate: false }): void;

  parentElement(): SimpleElement;

  firstNode(): SimpleNode;
  lastNode(): SimpleNode;
}

export interface TemplateIterator {
  next(): RichIteratorResult<null, RenderResult>;
  sync(): RenderResult;
}
