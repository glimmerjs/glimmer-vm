import {
  type Cursor,
  type ElementBuilder,
  type Environment,
  type SimpleNode,
} from '@glimmer/interfaces';
import { RehydrateBuilder } from '@glimmer/runtime';

export enum NodeType {
  RAW_NODE = -1,
  ELEMENT_NODE = 1,
  TEXT_NODE = 3,
  COMMENT_NODE = 8,
  DOCUMENT_NODE = 9,
  DOCUMENT_TYPE_NODE = 10,
  DOCUMENT_FRAGMENT_NODE = 11,
}

export class DebugRehydrationBuilder extends RehydrateBuilder {
  clearedNodes: SimpleNode[] = [];

  override remove(node: SimpleNode) {
    const next = super.remove(node);

    if (node.nodeType !== NodeType.COMMENT_NODE) {
      if (node.nodeType === NodeType.ELEMENT_NODE) {
        // don't stat serialized cursor positions
        if (node.tagName !== 'SCRIPT' || !node.getAttribute('glmr')) {
          this.clearedNodes.push(node);
        }
      } else {
        this.clearedNodes.push(node);
      }
    }

    return next;
  }
}

export function debugRehydration(env: Environment, cursor: Cursor): ElementBuilder {
  return DebugRehydrationBuilder.forInitialRender(env, cursor);
}
