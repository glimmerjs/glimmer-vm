import Environment from '../../environment';
import Bounds, { clear } from '../../bounds';
import { Opaque } from "@glimmer/interfaces";
import { NewElementBuilder } from '../element-builder';

export interface DynamicContent {
  bounds: Bounds;
  update(env: Environment, value: Opaque): DynamicContent;
}

export default abstract class DynamicContentBase implements DynamicContent {
  abstract update(env: Environment, value: Opaque): DynamicContent;

  public abstract bounds: Bounds;

  protected retry(env: Environment, value: Opaque): DynamicContent {
    let { bounds } = this;
    let parentElement = bounds.parentElement();
    let nextSibling = clear(bounds);

    let stack = new NewElementBuilder(env, parentElement, nextSibling);

    return stack.appendCautiousDynamicContent(value);
  }
}

export class DynamicContentWrapper implements DynamicContent {
  public bounds: Bounds;

  constructor(private inner: DynamicContent) {
    this.bounds = inner.bounds;
  }

  update(env: Environment, value: Opaque): DynamicContentWrapper {
    let inner = this.inner = this.inner.update(env, value);
    this.bounds = inner.bounds;
    return this;
  }
}