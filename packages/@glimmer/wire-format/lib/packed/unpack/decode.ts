import { ContentDecoder, ContentOutput, Template, UnpackContent } from './content';
import { ExprDecoder, ExprOutput, UnpackExpr } from './expr';

export class Decoder<E extends ExprOutput, C extends ContentOutput> {
  private expr: ExprDecoder<E>;
  private content: ContentDecoder<C, E>;

  constructor(content: UnpackContent<C, E>, expr: UnpackExpr<E>, private template: Template) {
    this.expr = new ExprDecoder(expr) as ExprDecoder<E>;
    this.content = new ContentDecoder(template, content, this.expr);
  }

  decode(): C['content'][] {
    return this.template.content.map((c) => this.content.content(c)) as C['content'][];
  }
}

export function decode<E extends ExprOutput, C extends ContentOutput>(
  content: UnpackContent<C, E>,
  expr: UnpackExpr<E>,
  template: Template
): C['content'][] {
  let exprDecoder = new ExprDecoder(expr);
  let contentDecoder = new ContentDecoder(template, content, exprDecoder);
  return template.content.map((c) => contentDecoder.content(c));
}
