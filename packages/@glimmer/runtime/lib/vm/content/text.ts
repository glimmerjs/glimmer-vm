import DynamicContentBase, { DynamicContent } from './dynamic';
import { ReifiableBounds } from '../../bounds';
import Environment from '../../environment';
import { isNode, isSafeString, isEmpty, isString } from '../../dom/normalize';
import { Opaque, Reifiable, NodeTokens } from "@glimmer/interfaces";

export default class DynamicTextContent extends DynamicContentBase implements Reifiable {
  constructor(public bounds: ReifiableBounds, private lastValue: string, trusted: boolean) {
    super(trusted);
  }

  reify(tokens: NodeTokens) {
    this.bounds.reify(tokens);
  }

  update(env: Environment, value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;
    if (isNode(value) || isSafeString(value)) return this.retry(env, value);

    let normalized: string;

    if (isEmpty(value)) {
      normalized = '';
    } else if (isString(value)) {
      normalized = value;
    } else {
      normalized = String(value);
    }

    if (normalized !== lastValue) {
      let textNode = this.bounds.firstNode();
      textNode.nodeValue = this.lastValue = normalized;
    }

    return this;
  }
}
