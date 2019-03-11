import * as hbs from '../types/handlebars-ast';

export class Hasher {
  hashStatements(nodes: hbs.Statement[]): string[] {
    let state: string[] = [];

    for (let node of nodes) {
      state.push(...this.statement(node));
    }

    return state;
  }

  hashNode(node: hbs.AnyNode): string | null {
    if (!node || typeof node !== 'object') {
      return null;
    }

    switch (node.type) {
      case 'MustacheStatement':
      case 'MustacheContent':
      case 'BlockStatement':
      case 'ElementNode':
      case 'TextNode':
      case 'ConcatStatement':
      case 'HtmlCommentNode':
      case 'Newline':
      case 'CommentStatement':
        return JSON.stringify(this.statement(node));

      case 'SubExpression':
      case 'PathExpression':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'UndefinedLiteral':
      case 'NullLiteral':
        return JSON.stringify(this.expression(node));

      case 'AttrNode':
        return JSON.stringify([`attr`, node.name.name]);

      default:
        return null;
    }
  }

  statement(node: hbs.Statement): string[] {
    switch (node.type) {
      case 'TextNode':
        return ['text', node.value];
      case 'Newline':
        return ['newline'];
      case 'CommentStatement':
        return ['comment', node.value];
      case 'HtmlCommentNode':
        return ['html-comment', node.value];
      case 'MustacheContent':
        return ['mustache-content', ...this.expression(node.value)];
      case 'MustacheStatement':
        return ['mustache', ...this.callBody(node.body)];
      case 'ConcatStatement':
        return ['concat'];
      case 'BlockStatement':
        if (node.program.call) {
          return ['block', ...this.callBody(node.program.call)];
        } else {
          return ['block'];
        }
      case 'ElementNode':
        return ['element', ...this.expression(node.tag)];
    }
  }

  hashExpressions(nodes: hbs.Expression[]): string[] {
    let state: string[] = [];

    for (let node of nodes) {
      state.push(...this.expression(node));
    }

    return state;
  }

  expression(node: hbs.Expression): string[] {
    let state: string[] = ['expr'];
    switch (node.type) {
      case 'NullLiteral':
        return ['expr:null'];
      case 'UndefinedLiteral':
        return ['expr:undefined'];
      case 'BooleanLiteral':
        return ['expr:boolean', String(node.value)];
      case 'NumberLiteral':
        return ['expr:number', String(node.value)];
      case 'StringLiteral':
        return ['expr:string', node.value];
      case 'PathExpression':
        return ['expr:path', ...this.path(node)];
      case 'SubExpression':
        return ['expr:sexp', ...this.callBody(node.body)];
    }
  }

  private callBody(node: hbs.CallBody): string[] {
    let state: string[] = ['call-body'];

    let { call, params, hash, blockParams } = node;

    state.push(...this.expression(call));

    // if (params) {
    //   state.push(...this.hashExpressions(params));
    // }

    // if (hash) {
    //   state.push(...this.hashHash(hash));
    // }

    // if (blockParams) {
    //   state.push('block-params', ...this.hashBlockParams(blockParams));
    // }

    return state;
  }

  private path(node: hbs.PathExpression): string[] {
    let { head, tail } = node;
    let state: string[] = ['path'];

    switch (head.type) {
      case 'ArgReference':
        state.push(`@${head.name}`);
        break;
      case 'LocalReference':
        state.push(`${head.name}`);
        break;
      case 'This':
        state.push(`this`);
        break;
    }

    if (tail) {
      for (let item of tail) {
        state.push(this.segment(item));
      }
    }

    return state;
  }

  private hashHash(node: hbs.Hash): string[] {
    let state: string[] = ['hash'];

    let { pairs } = node;

    for (let pair of pairs) {
      state.push(...this.hashPair(pair));
    }

    return state;
  }

  private hashPair(node: hbs.HashPair): string[] {
    return ['hash-pair', node.key, ...this.expression(node.value)];
  }

  private hashBlockParams(node: hbs.BlockParams): string[] {
    let params = node.params.map(p => p.name);

    return ['block-params', ...params];
  }

  private segment(node: hbs.PathSegment): string {
    return node.name;
  }
}

export function hashNode(node: hbs.AnyNode): string | null {
  return new Hasher().hashNode(node);
}
