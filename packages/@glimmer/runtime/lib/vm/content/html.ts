import DynamicContentBase, { DynamicContent } from './dynamic';
import Bounds from '../../bounds';
import { isSafeString, SafeString, normalizeTrustedValue } from '../../dom/normalize';
import { Opaque, Simple } from "@glimmer/interfaces";

export default class DynamicHTMLContent extends DynamicContentBase {
  constructor(doc: Simple.Document, public bounds: Bounds, private lastValue: SafeString, trusted: boolean) {
    super(doc, trusted);
  }

  update(value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;

    if (isSafeString(value) && value.toHTML() === lastValue.toHTML()) {
      this.lastValue = value;
      return this;
    }

    return this.retry(value);
  }
}

export class DynamicTrustedHTMLContent extends DynamicContentBase {
  constructor(doc: Simple.Document, public bounds: Bounds, private lastValue: string, trusted: boolean) {
    super(doc, trusted);
  }

  update(value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;
    let newValue = normalizeTrustedValue(value);
    if (newValue === lastValue) return this;

    return this.retry(value);
  }
}
