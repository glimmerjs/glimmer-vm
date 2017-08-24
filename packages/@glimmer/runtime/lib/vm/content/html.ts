import { Opaque } from '@glimmer/interfaces';
import Bounds from '../../bounds';
import { SafeString, isSafeString, normalizeTrustedValue } from '../../dom/normalize';
import Environment from '../../environment';
import DynamicContentBase, { DynamicContent } from './dynamic';

export default class DynamicHTMLContent extends DynamicContentBase {
  constructor(public bounds: Bounds, private lastValue: SafeString, trusted: boolean) {
    super(trusted);
  }

  update(env: Environment, value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;

    if (isSafeString(value) && value.toHTML() === lastValue.toHTML()) {
      this.lastValue = value;
      return this;
    }

    return this.retry(env, value);
  }
}

export class DynamicTrustedHTMLContent extends DynamicContentBase {
  constructor(public bounds: Bounds, private lastValue: string, trusted: boolean) {
    super(trusted);
  }

  update(env: Environment, value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;
    let newValue = normalizeTrustedValue(value);
    if (newValue === lastValue) return this;

    return this.retry(env, value);
  }
}
