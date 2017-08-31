import { Opaque, NodeToken } from "@glimmer/interfaces";
import { TreeBuilder } from "@glimmer/dom-change-list";

import { isFragment, isNode, isSafeString, isEmpty, isString } from '../../dom/normalize';
import { tokenBounds } from '../../bounds';
import DynamicTextContent from '../../vm/content/text';

export function appendCautiousDynamicContent(value: Opaque, parent: NodeToken, builder: TreeBuilder): DynamicTextContent {
  if (isFragment(value)) {
    throw new Error('unimplemented append fragment');
  } else if (isNode(value)) {
    throw new Error('unimplemented append node');
  } else if (isSafeString(value)) {
    throw new Error('unimplemented append HTML (safe string)');
  } else {
    let normalized: string;

    if (isEmpty(value)) {
      normalized = '';
    } else if (isString(value)) {
      normalized = value;
    } else {
      normalized = String(value);
    }

    let textNode = builder.appendText(normalized);
    let bounds = tokenBounds(parent, textNode);

    return new DynamicTextContent(bounds, normalized, false);
  }
}

export function appendTrustingDynamicContent() {

}