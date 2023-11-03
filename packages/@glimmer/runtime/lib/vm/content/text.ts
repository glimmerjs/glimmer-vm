import type { SimpleText, UpdatingOpcode } from '@glimmer/interfaces';
import { type SomeReactive, unwrapReactive } from '@glimmer/reference';

import { isEmpty, isString } from '../../dom/normalize';

export default class DynamicTextContent implements UpdatingOpcode {
  constructor(
    public node: SimpleText,
    private reference: SomeReactive<unknown>,
    private lastValue: string
  ) {}

  evaluate() {
    let value = unwrapReactive(this.reference);

    let { lastValue } = this;

    if (value === lastValue) return;

    let normalized: string;

    if (isEmpty(value)) {
      normalized = '';
    } else if (isString(value)) {
      normalized = value;
    } else {
      normalized = String(value);
    }

    if (normalized !== lastValue) {
      let textNode = this.node;
      textNode.nodeValue = this.lastValue = normalized;
    }
  }
}
