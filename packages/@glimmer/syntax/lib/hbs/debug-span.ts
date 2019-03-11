import * as hbs from '../types/handlebars-ast';

export class DebugSpan {
  constructor(private source: string) {}

  span(ast: hbs.Root): void {
    this.update(ast);

    if (ast.body) {
      for (let item of ast.body) {
        this.statement(item);
      }
    }
  }

  block(item: hbs.Program): void {
    this.update(item);

    if (item.call) this.callBody(item.call);
    if (item.body) item.body.forEach(b => this.statement(b));
  }

  statement(item: hbs.Statement): void {
    this.update(item);

    switch (item.type) {
      case 'HtmlCommentNode':
      case 'Newline':
      case 'CommentStatement':
      case 'TextNode':
        return;

      case 'BlockStatement':
        return;

      case 'ConcatStatement':
        return;

      case 'ElementNode':
        this.expression(item.tag);
        if (item.attributes) item.attributes.forEach(a => this.attrs(a));
        if (item.blockParams) this.blockParams(item.blockParams);
        if (item.modifiers) item.modifiers.forEach(m => this.modifier(m));
        if (item.comments) item.comments.forEach(c => this.statement(c));
        if (item.body) this.block(item.body);
        return;

      case 'MustacheContent':
        this.expression(item.value);
        return;

      case 'MustacheStatement':
        this.callBody(item.body);
        return;
    }
  }

  expression(item: hbs.Expression): void {
    this.update(item);

    switch (item.type) {
      case 'BooleanLiteral':
      case 'NullLiteral':
      case 'NumberLiteral':
      case 'UndefinedLiteral':
      case 'StringLiteral':
        return;

      case 'PathExpression':
        this.update(item.head);
        if (item.tail) item.tail.forEach(s => this.update(s));
        return;

      case 'SubExpression': {
        this.callBody(item.body);
        return;
      }
    }
  }

  callBody(item: hbs.CallBody): void {
    this.update(item);
    this.expression(item.call);
    if (item.params) item.params.forEach(p => this.expression(p));
    if (item.hash) this.hash(item.hash);
    if (item.blockParams) this.blockParams(item.blockParams);
  }

  hash(item: hbs.Hash): void {
    this.update(item);

    for (let pair of item.pairs) {
      this.update(pair);
      this.expression(pair.value);
    }
  }

  blockParams(item: hbs.BlockParams): void {
    this.update(item);
    item.params.forEach(p => this.update(p));
  }

  attrs(item: hbs.AttrNode): void {
    this.update(item);
    this.update(item.name);
    if (item.value) this.statement(item.value);
  }

  modifier(_item: hbs.ElementModifierStatement): void {
    throw new Error(`Unimplemented, DebugSpan#modifier`);
  }

  private update(node: { span: hbs.Span }): void {
    node.span.slice = this.source.slice(node.span.start, node.span.end);
  }
}

export function annotateSpans(ast: hbs.Root, source: string): void {
  new DebugSpan(source).span(ast);
}
