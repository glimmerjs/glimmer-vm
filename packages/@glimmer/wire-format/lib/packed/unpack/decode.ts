import {
  ContentDecoder,
  ContentFor,
  ContentForUnpacker,
  ContentOutput,
  Template,
  UnpackContent,
} from './content';
import { ExprDecoder, ExprOutput, ExprOutputFor, UnpackExpr } from './expr';

export class Decoder<
  E extends UnpackExpr<ExprOutput>,
  C extends UnpackContent<ContentOutput, ExprOutputFor<E>>
> {
  private expr: ExprDecoder<ExprOutputFor<E>>;
  private content: ContentDecoder<ContentOutput, ExprOutputFor<E>>;

  constructor(content: C, expr: E, private template: Template) {
    this.expr = new ExprDecoder(expr) as ExprDecoder<ExprOutputFor<E>>;
    this.content = new ContentDecoder(template, content, this.expr);
  }

  decode(): ContentForUnpacker<C>[] {
    return this.template.content.map((c) => this.content.content(c)) as ContentForUnpacker<C>[];
  }
}

export function decode<E extends ExprOutput, U extends UnpackContent<ContentOutput, E>>(
  content: U,
  expr: UnpackExpr<E>,
  template: Template
): ContentFor<U extends UnpackContent<infer C, E> ? C : never>[] {
  let exprDecoder = new ExprDecoder(expr);
  let contentDecoder = new ContentDecoder(template, content, exprDecoder);
  return template.content.map((c) => contentDecoder.content(c));
}
