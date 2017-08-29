import DynamicContentBase, { DynamicContent } from './dynamic';
import Bounds from '../../bounds';
import { Opaque, Simple } from "@glimmer/interfaces";

export default class DynamicNodeContent extends DynamicContentBase {
  constructor(doc: Simple.Document, public bounds: Bounds, private lastValue: Simple.Node, trusting: boolean) {
    super(doc, trusting);
  }

  update(value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;

    return this.retry(value);
  }
}
