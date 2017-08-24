import { Option } from '../core';
import * as Simple from './simple';

export interface Bounds {
  // a method to future-proof for wormholing; may not be needed ultimately
  parentElement(): Simple.Element;
  firstNode(): Option<Simple.Node>;
  lastNode(): Option<Simple.Node>;
}
