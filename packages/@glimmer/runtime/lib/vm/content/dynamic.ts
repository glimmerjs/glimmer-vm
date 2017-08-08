import Bounds, { clear } from '../../bounds';
import { Opaque, Simple, Option } from "@glimmer/interfaces";
import { elementBuilder } from '../element-builder';

export interface DynamicContent {
  bounds: Bounds;
  update(value: Opaque): DynamicContent;
}

abstract class DynamicContentBase implements DynamicContent {
  constructor(protected doc: Simple.Document, protected trusting: boolean) {}

  abstract update(value: Opaque): DynamicContent;

  public abstract bounds: Bounds;

  protected retry(value: Opaque): DynamicContent {
    let { bounds } = this;
    let parentElement = bounds.parentElement();
    let nextSibling = clear(bounds);

    let stack = elementBuilder(this.doc, { element: parentElement, nextSibling });

    if (this.trusting) {
      return stack.__appendTrustingDynamicContent(value);
    } else {
      return stack.__appendCautiousDynamicContent(value);
    }
  }
}

export default DynamicContentBase;

export class DynamicContentWrapper implements DynamicContent, Bounds {
  parentElement(): Simple.Element {
    return this.bounds.parentElement();
  }

  firstNode(): Option<Simple.Node> {
    return this.bounds.firstNode();
  }

  lastNode(): Option<Simple.Node> {
    return this.bounds.lastNode();
  }

  public bounds: Bounds;

  constructor(private inner: DynamicContent) {
    this.bounds = inner.bounds;
  }

  update(value: Opaque): DynamicContentWrapper {
    let inner = this.inner = this.inner.update(value);
    this.bounds = inner.bounds;
    return this;
  }
}
