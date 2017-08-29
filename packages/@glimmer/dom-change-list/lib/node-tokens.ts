import { Simple } from '@glimmer/interfaces';

export type NodeToken = number;

export class NodeTokens {
  private nodes: Simple.Node[];

  register(node: Simple.Node): NodeToken {
    let token = this.nodes.length;
    this.nodes.push(node);
    return token;
  }

  reify(token: NodeToken): Simple.Node {
    return this.nodes[token];
  }
}