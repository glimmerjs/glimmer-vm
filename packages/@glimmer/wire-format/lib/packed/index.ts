import { Content } from './content';

export * as expr from './expr';
export { Expression, ExprOp, SpecialExpr, LiteralValue, Null } from './expr';
export * as shared from './shared';
export { list } from './shared';
export * as content from './content';
export { Content, ContentOp } from './content';

export interface Template {
  content: Content[];
  symbols: string[];
  upvars: string[];
  hasEval: boolean;
}
