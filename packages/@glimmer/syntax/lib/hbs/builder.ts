import { keys } from '../../../util';

export class Builder {
  private pos = 0;
}

export interface AnyProgram {
  type: 'Program';
  body: Statement[];
}

export interface Program {
  type: 'Program';
  body: Statement[];
  blockParams: string[];
}

export type Statement = MustacheStatement | BlockStatement | ContentStatement | CommentStatement;

export interface CommonMustache {
  path: Expression;
  params: Expression[];
  hash: Hash | null;
  trusted: boolean;
  strip?: StripFlags;
}

export interface MustacheStatement extends CommonMustache, MustacheBody {
  type: 'MustacheStatement';
}

export function mustache(
  path: Expression,
  { params, hash }: { params?: Expression[]; hash: Hash | null }
): MustacheStatement {
  return {
    type: 'MustacheStatement',
    path,
    params: params || [],
    hash,
    trusted: false,
  };
}

export interface MustacheBody {
  path: Expression;
  params: Expression[];
  hash: Hash | null;
}

export interface CommonBlock extends MustacheBody {
  path: Expression;
  params: Expression[];
  hash: Hash | null;
  program: Program;
  inverse: Program | null;
  openStrip?: StripFlags;
  inverseStrip?: StripFlags;
  closeStrip?: StripFlags;
}

export interface BlockStatement extends CommonBlock {
  type: 'BlockStatement';
}

export function block(
  path: Expression,
  {
    params,
    hash,
    program,
    inverse,
  }: { params?: Expression[]; hash?: Hash; program: Program; inverse?: Program }
) {
  return {
    type: 'BlockStatement',
    path,
    params: params || [],
    hash: hash || null,
    program,
    inverse: inverse || null,
  };
}

export interface ContentStatement {
  type: 'ContentStatement';
  value: string;
}

export function content(value: string): ContentStatement {
  return {
    type: 'ContentStatement',
    value,
  };
}

export interface CommentStatement {
  type: 'CommentStatement';
  value: string;
}

export function comment(value: string): CommentStatement {
  return {
    type: 'CommentStatement',
    value,
  };
}

export type Expression = SubExpression | PathExpression | Literal;

export interface SubExpression extends MustacheBody {
  type: 'SubExpression';
  path: Expression;
  params: Expression[];
  hash: Hash | null;
}

export function sexpr(
  path: Expression,
  { params, hash }: { params?: Expression[]; hash?: Hash }
): SubExpression {
  return {
    type: 'SubExpression',
    path,
    params: params || [],
    hash: hash || null,
  };
}

export interface PathExpression {
  type: 'PathExpression';
  head: Variable | Arg;
  tail: string[];
}

export function path(path: string): PathExpression {
  let parts = path.split('.');
  return {
    type: 'PathExpression',
    head: {
      type: 'Variable',
      name: parts[0],
    },
    tail: parts.slice(1),
  };
}

export function atPath(path: string): PathExpression {
  let parts = path.split('.');
  return {
    type: 'PathExpression',
    head: {
      type: 'Arg',
      name: parts[0],
    },
    tail: parts.slice(1),
  };
}

export interface Variable {
  type: 'Variable';
  name: string;
}

export interface Arg {
  type: 'Arg';
  name: string;
}

export type Literal =
  | StringLiteral
  | BooleanLiteral
  | NumberLiteral
  | UndefinedLiteral
  | NullLiteral;

export function literal(value: string | boolean | number | null | undefined): Literal {
  if (value === null) {
    return { type: 'NullLiteral', value: null };
  } else if (value === undefined) {
    return { type: 'UndefinedLiteral', value: undefined };
  } else {
    switch (typeof value) {
      case 'string':
        return { type: 'StringLiteral', value };
      case 'boolean':
        return { type: 'BooleanLiteral', value };
      case 'number':
        return { type: 'NumberLiteral', value };
      default:
        throw new Error(`Unexhausted ${value}`);
    }
  }
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface UndefinedLiteral {
  type: 'UndefinedLiteral';
  value: undefined;
}

export interface NullLiteral {
  type: 'NullLiteral';
  value: null;
}

export interface Hash {
  pairs: HashPair[];
}

export function hash(map: { [key: string]: Expression }): Hash {
  let out: HashPair[] = [];

  for (let key of keys(map)) {
    out.push({ key: key as string, value: map[key] });
  }

  return { pairs: out };
}

export interface HashPair {
  key: string;
  value: Expression;
}

export interface StripFlags {
  open: boolean;
  close: boolean;
}
