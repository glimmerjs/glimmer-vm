import type { SimpleElement, SimpleNode } from '@simple-dom/interface';
import type { RichIteratorResult } from '../core';
import type { BlockBounds } from '../dom/bounds';
import type { Environment } from './environment';
import type { UpdatingOpcode } from './vm';

export interface ExceptionHandler {
  unwind(): boolean;
  handleException(): void;
}

export interface RenderResult extends BlockBounds, ExceptionHandler {
  readonly env: Environment;
  readonly drop: object;
  readonly error?: unknown;
  readonly children: UpdatingOpcode[];

  rerender(options?: { alwaysRevalidate: false }): void;

  parentElement(): SimpleElement;

  firstNode(): SimpleNode;
  lastNode(): SimpleNode;
}

export interface TemplateIterator {
  next(): RichIteratorResult<null, RenderResult>;
  sync(): RenderResult;
}
