import { NewElementBuilder, ElementBuilder } from "./element-builder";

import Bounds, { bounds } from '../bounds';

export class SerializeBuilder extends NewElementBuilder implements ElementBuilder {
  __appendHTML(html: string): Bounds {
    let first = this.__appendComment('%glimmer%');
    super.__appendHTML(html);
    let last = this.__appendComment('%glimmer%');
    return bounds(this.element, first, last);
  }
}
