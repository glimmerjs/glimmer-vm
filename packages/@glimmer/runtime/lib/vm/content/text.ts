import { isEmpty, isString } from '../../dom/normalize';
import { Source, UpdatingOpcode } from '@glimmer/interfaces';
import { getValue } from '@glimmer/validator';
import { SimpleText } from '@simple-dom/interface';

export default class DynamicTextContent implements UpdatingOpcode {
  constructor(public node: SimpleText, private reference: Source, private lastValue: string) {}

  evaluate() {
    let value = getValue(this.reference);

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
