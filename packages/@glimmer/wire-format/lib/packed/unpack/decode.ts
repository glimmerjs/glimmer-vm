import { ContentDecoder, ContentOutput, Template, UnpackContent } from './content';
import { ExprDecoder, ExprOutput, UnpackExpr } from './expr';

export function decode<C extends ContentOutput, E extends ExprOutput>(
  content: UnpackContent<C, E>,
  expr: UnpackExpr<E>,
  template: Template
): C['content'][] {
  let exprDecoder = new ExprDecoder(expr);
  let contentDecoder = new ContentDecoder(template, content, exprDecoder);
  return template.content.map((c) => contentDecoder.content(c));
}
