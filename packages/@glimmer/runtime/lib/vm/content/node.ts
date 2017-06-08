import DynamicContentBase, { DynamicContent } from './dynamic';
import { SingleNodeBounds } from '../../bounds';
import Environment from '../../environment';
import { Opaque, Simple } from "@glimmer/interfaces";

export default class DynamicNodeContent extends DynamicContentBase {
  constructor(public bounds: SingleNodeBounds, private lastValue: Simple.Node, trusting: boolean) {
    super(trusting);
  }

  update(env: Environment, value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;

    return this.retry(env, value);
  }
}
