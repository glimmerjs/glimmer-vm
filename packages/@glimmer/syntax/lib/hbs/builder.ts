import { keys } from '@glimmer/util';
import * as hbs from '../types/handlebars-ast';
import { Option } from '@glimmer/interfaces';

export class AstBuilder {
  private pos = 0;

  build(program: BuilderAst): hbs.Root {
    let statements: hbs.Statement[] = [];

    return this.spanned(() => {
      for (let statement of program.body) {
        let s = this.visit(statement);
        if (s) statements.push(s);
      }

      return span => ({
        type: 'Root',
        span,
        body: statements,
      });
    });
  }

  visit(statement: Statement): hbs.Statement | null {
    switch (statement.type) {
      case 'CommentStatement': {
        return this.spanned(() => {
          this.consume('{{!');
          if (statement.block) this.consume('--');
          this.consume(statement.value);
          if (statement.block) this.consume('--');
          this.consume('}}');

          return span => ({
            type: 'CommentStatement',
            span,
            value: statement.value,
          });
        });
      }

      case 'ContentStatement': {
        let span = this.consume(statement.value);

        return {
          type: 'ContentStatement',
          span,
          value: statement.value,
        };
      }

      case 'BlockStatement':
        return this.spanned(() => {
          this.consume('{{#');
          let inside = this.insideMustache(statement.mustache.contents);

          if (inside === null) {
            throw new Error(`unexpected empty {{#}}`);
          }

          let { body, callSize, blockParams } = inside;

          let programs = this.programs(statement.programs, body);

          this.consume('{{/');

          if (programs.close) {
            for (let part of programs.close.parts) {
              if (typeof part === 'string') {
                this.consume(part);
              } else {
                this.consume(part.body);
              }
            }
          } else {
            this.pos += callSize;
          }

          this.consume('}}');

          programs.default.blockParams = blockParams;

          return span => ({
            type: 'BlockStatement',
            span,
            program: programs.default,
            inverses: programs.else,
          });
        });

      case 'Whitespace':
        this.consume(statement.body);
        return null;

      case 'SkippedWhitespace':
        this.skip(statement.body);
        return null;

      case 'MustacheStatement':
        return this.mustache(statement);
    }
  }

  program(program: Program, callBody: hbs.CallBody): hbs.Program {
    return this.spanned(() => {
      let body: hbs.Statement[] = [];

      for (let item of program.parts) {
        let next = this.visit(ToStatementPart(item));
        if (next) body.push(next);
      }

      return span => ({
        type: 'Program',
        span,
        call: callBody,
        body: body.length ? body : null,
        blockParams: null,
      });
    });
  }

  inverse(inverse: Inverse): hbs.Program {
    this.consume('{{else');
    let inside = this.insideMustache(inverse.mustache.contents);
    this.consume('}}');

    return this.spanned(() => {
      let body: hbs.Statement[] = [];

      for (let item of inverse.parts) {
        let next = this.visit(ToStatementPart(item));
        if (next) body.push(next);
      }

      return span => ({
        type: 'Program',
        span,
        call: inside && inside.body,
        body: body.length ? body : null,
        blockParams: inside === null ? null : inside.blockParams,
      });
    });
  }

  programs(
    programs: ToProgramPart[],
    callBody: hbs.CallBody
  ): {
    default: hbs.Program;
    else: Option<hbs.Program[]>;
    close: Option<CloseBlock>;
  } {
    let defaultBlock: hbs.Program | null = null;
    let inverseBlock: hbs.Program | null = null;
    let close: Option<CloseBlock> = null;

    this.consume('}}');
    let start = this.pos;

    for (let part of programs) {
      if (part.type === 'SkippedWhitespace') {
        this.skip(part.body);
        continue;
      } else if (part.type === 'Program') {
        defaultBlock = this.program(part, callBody);
      } else if (part.type === 'Else') {
        defaultBlock!.span = { start, end: this.pos };
        inverseBlock = this.inverse(part);
      } else if (part.type === 'CloseBlock') {
        close = part;
      }
    }

    if (defaultBlock && defaultBlock.span) {
      if (!inverseBlock) {
        defaultBlock.span = { start, end: this.pos };
      }
    }

    if (defaultBlock === null) {
      throw new Error(`Must pass at least one block to blockCall`);
    }

    return { default: defaultBlock, else: inverseBlock ? [inverseBlock] : null, close };
  }

  mustache(statement: MustacheStatement): hbs.MustacheStatement | hbs.MustacheContent {
    return this.spanned<hbs.MustacheStatement | hbs.MustacheContent>(() => {
      this.consume('{{');

      let inside = this.insideMustache(statement.contents);

      if (inside === null) {
        throw new Error(`unexpected empty {{}}`);
      }

      let body = inside.body;

      this.consume('}}');

      if (!body.params && !body.hash) {
        return span => ({
          type: 'MustacheContent',
          span,
          value: body.call,
          trusted: false,
        });
      } else {
        return span => ({
          type: 'MustacheStatement',
          span,
          body,
          trusted: false,
        });
      }
    });
  }

  insideMustache(
    contents: MustacheContents
  ): {
    callSize: number;
    body: hbs.CallBody;
    blockParams: Option<string[]>;
  } | null {
    let foundCall: { call: hbs.Expression; size: number } | undefined = undefined;
    let foundHash: hbs.Hash | null | undefined = undefined;
    let params: hbs.Expression[] = [];
    let blockParams: Option<string[]> = null;
    let last: number = this.pos;
    let needsWs = false;

    for (let param of contents) {
      if (param.type !== 'Whitespace' && needsWs) {
        this.consume(' ');
        needsWs = false;
      }

      if (param.type === 'As') {
        this.consume('as |');
        param.parts.forEach(p => this.consume(p));
        this.consume('|');
        last = this.pos;
        blockParams = param.parts;
        continue;
      }

      if (foundCall === undefined && param.type !== 'Whitespace') {
        if (param.type === 'Hash') {
          throw new Error(`The first element of a mustache may not be a hash`);
        }

        let start = this.pos;
        foundCall = { call: this.expr(param), size: this.pos - start };
        last = this.pos;
        needsWs = true;
      } else if (param.type === 'Whitespace') {
        this.consume(param.body);
        needsWs = false;
      } else if (param.type === 'Hash') {
        foundHash = this.hash(param);
        last = this.pos;
        needsWs = true;
      } else {
        params.push(this.expr(param));
        last = this.pos;
        needsWs = true;
      }
    }

    if (foundCall === undefined) {
      return null;
    }

    return {
      callSize: foundCall.size,
      body: {
        type: 'CallBody',
        span: { start: foundCall.call.span.start, end: last },
        call: foundCall.call,
        params: params.length ? params : null,
        hash: foundHash || null,
      },
      blockParams,
    };
  }

  path(expression: PathExpression): hbs.PathExpression {
    return this.spanned(() => {
      let head = this.var(expression.head);
      let tail = this.segments(expression.tail);

      return span => ({ type: 'PathExpression', span, head, tail });
    });
  }

  expr(expression: Whitespace): null;
  expr(expression: Expression): hbs.Expression;
  expr(expression: Expression): hbs.Expression | null {
    switch (expression.type) {
      case 'BooleanLiteral':
        return this.spanned(() => {
          this.consume(String(expression.value));

          return span => ({ type: 'BooleanLiteral', span, value: expression.value });
        });

      case 'NumberLiteral':
        return this.spanned(() => {
          this.consume(String(expression.value));

          return span => ({ type: 'NumberLiteral', span, value: expression.value });
        });

      case 'StringLiteral':
        return this.spanned(() => {
          this.consume(JSON.stringify(expression.value));

          return span => ({ type: 'StringLiteral', span, value: expression.value });
        });

      case 'PathExpression':
        return this.path(expression);

      case 'UndefinedLiteral':
        return this.spanned(() => {
          this.consume('undefined');
          return span => ({
            type: 'UndefinedLiteral',
            span,
            value: undefined,
          });
        });

      case 'NullLiteral':
        return this.spanned(() => {
          this.consume('null');
          return span => ({
            type: 'NullLiteral',
            span,
            value: null,
          });
        });

      case 'Whitespace':
        this.consume(expression.body);
        return null;

      case 'SubExpression': {
        return this.spanned(() => {
          this.consume('(');

          const inside = this.insideMustache(expression.contents);

          if (inside === null) {
            throw new Error(`Unexpected empty ()`);
          }

          this.consume(')');

          return span => ({
            type: 'SubExpression',
            span,
            body: inside.body,
          });
        });
      }
    }
  }

  var(item: Head): hbs.Head {
    return this.spanned<hbs.Head>(() => {
      if (item.type === 'LocalReference') {
        this.consume(item.name);
        return span => ({ type: 'LocalReference', span, name: item.name });
      } else if (item.type === 'This') {
        this.consume('this');
        return span => ({ type: 'This', span });
      } else {
        this.consume('@');
        this.consume(item.name);
        return span => ({ type: 'ArgReference', span, name: item.name });
      }
    });
  }

  segments(items: string[] | null): hbs.PathSegment[] | null {
    if (items === null) return null;

    return items.map(item => {
      this.consume('.');
      return this.spanned(() => {
        this.consume(item);
        return span => ({ type: 'PathSegment', span, name: item });
      });
    });
  }

  exprs(params: Expression[]): hbs.Expression[] {
    let out: hbs.Expression[] = [];

    for (let param of params) {
      let next = this.expr(param);
      if (next) out.push(next);
    }

    return out;
  }

  hash(hash: Hash | null): hbs.Hash | null {
    if (hash === null) return null;

    return this.spanned(() => {
      let out: hbs.HashPair[] = [];

      let pairs = hash.pairs;
      let last = hash.pairs.length - 1;
      for (let i = 0; i < pairs.length; i++) {
        out.push(this.hashPair(pairs[i]));
        if (i !== last) this.consume(' ');
      }

      return span => ({
        type: 'Hash',
        span,
        pairs: out,
      });
    });
  }

  hashPair(pair: HashPair): hbs.HashPair {
    if (pair.value === null) {
      throw new Error(`the value of a hash pair must not be whitespace`);
    }

    return this.spanned(() => {
      this.consume(pair.key);
      this.consume('=');
      let value = this.expr(pair.value);

      return span => ({
        type: 'HashPair',
        span,
        key: pair.key,
        value,
      });
    });
  }

  consume(chars: string): hbs.Span {
    let pos = this.pos;
    this.pos += chars.length;
    return { start: pos, end: this.pos };
  }

  skip(chars: string): void {
    this.pos += chars.length;
  }

  spanned<T extends hbs.AnyNode>(cb: () => (span: hbs.Span) => T): T {
    let pos = this.pos;

    let next = cb();
    return next({ start: pos, end: this.pos });
  }
}

export interface BuilderAst {
  type: 'Program';
  body: Statement[];
}

export function ast(...statements: Statement[]): BuilderAst {
  return {
    type: 'Program',
    body: statements,
  };
}

export interface Program {
  type: 'Program';
  parts: ToStatementPart[];
}

export interface Inverse {
  type: 'Else';
  mustache: MustacheStatement;
  parts: ToStatementPart[];
}

export interface As {
  type: 'As';
  parts: string[];
}

export function as(parts: string[]) {
  return {
    type: 'As',
    parts,
  };
}

export function block(...parts: ToStatementPart[]): Program {
  return {
    type: 'Program',
    parts,
  };
}

export function inverse(mustacheParts: ToMustachePart[], ...parts: ToStatementPart[]): Inverse {
  return {
    type: 'Else',
    mustache: mustache(...mustacheParts),
    parts,
  };
}

export type Statement =
  | MustacheStatement
  | BlockStatement
  | ContentStatement
  | CommentStatement
  | Whitespace
  | SkippedWhitespace;

export interface CommonMustache {
  call: Expression;
  params: Expression[];
  hash: Hash | null;
  trusted: boolean;
  strip?: StripFlags;
}

export interface MustacheStatement {
  type: 'MustacheStatement';
  contents: MustacheContents;
  trusted: boolean;
  strip?: StripFlags;
}

export type BuilderMustache = MustacheStatement;

export type MustacheContent = Expression | Hash | As;
export type ToMustachePart = MustacheContent | As | string | boolean | number | null | undefined;
export type MustacheContents = MustacheContent[];

export type ToHashPart = Expression | string | boolean | number | null | undefined;

export type ToStatementPart = Statement | Whitespace | string;
export type StatementPart = Statement | Whitespace;

export function ToMustachePart(part: ToMustachePart): MustacheContent {
  if (typeof part === 'string') {
    return path(part);
  } else if (typeof part === 'boolean') {
    return literal(part);
  } else if (typeof part === 'number') {
    return literal(part);
  } else if (part === null || part === undefined) {
    return literal(part);
  } else {
    return part;
  }
}

export function ToHashPart(part: ToHashPart): Expression {
  if (typeof part === 'string') {
    return path(part);
  } else if (typeof part === 'boolean') {
    return literal(part);
  } else if (typeof part === 'number') {
    return literal(part);
  } else if (part === null || part === undefined) {
    return literal(part);
  } else {
    return part;
  }
}

export function ToStatementPart(value: ToStatementPart): StatementPart {
  if (typeof value === 'string') {
    return { type: 'ContentStatement', value };
  } else {
    return value;
  }
}

export function mustache(...params: ToMustachePart[]): MustacheStatement {
  let parts = params.map(ToMustachePart);

  return {
    type: 'MustacheStatement',
    contents: parts,
    trusted: false,
  };
}

export function ws(body = ' '): Whitespace {
  return {
    type: 'Whitespace',
    body,
  };
}

export function skip(body = '\n'): SkippedWhitespace {
  return {
    type: 'SkippedWhitespace',
    body,
  };
}

export interface Whitespace {
  type: 'Whitespace';
  body: string;
}

export interface SkippedWhitespace {
  type: 'SkippedWhitespace';
  body: string;
}

export interface MustacheBody {
  call: Expression;
  params: Expression[];
  hash: Hash | null;
}

export interface CommonBlock {
  call: PathExpression;
  parts: ToProgramPart[];
}

export interface BlockStatement {
  type: 'BlockStatement';
  mustache: MustacheStatement;
  programs: ToProgramPart[];
}

export interface CloseBlock {
  type: 'CloseBlock';
  parts: Array<Whitespace | string>;
}

export function close(...parts: Array<Whitespace | string>): CloseBlock {
  return {
    type: 'CloseBlock',
    parts,
  };
}

type ToProgramPart = Program | Inverse | Whitespace | SkippedWhitespace | CloseBlock;

export function blockCall(
  mustacheParts: ToMustachePart[],
  ...programs: ToProgramPart[]
): BlockStatement {
  return {
    type: 'BlockStatement',
    mustache: mustache(...mustacheParts),
    programs,
    // params: params ? params.map(ToHashPart) : [],
    // hash: hash || null,
    // program,
    // inverse: inverse || null,
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
  block: boolean;
}

export function comment(value: string): CommentStatement {
  let match = value.match(/^--(.*)--$/);

  if (match) {
    return {
      type: 'CommentStatement',
      value: match[1],
      block: true,
    };
  } else {
    return {
      type: 'CommentStatement',
      value,
      block: false,
    };
  }
}

export type Expression = SubExpression | PathExpression | Literal | Whitespace;

export interface SubExpression {
  type: 'SubExpression';
  contents: MustacheContents;
}

export function sexpr(...contents: ToMustachePart[]): SubExpression {
  return {
    type: 'SubExpression',
    contents: contents.map(ToMustachePart),
  };
}

export interface PathExpression {
  type: 'PathExpression';
  head: LocalReference | ArgReference | This;
  tail: string[] | null;
}

export function path(path: string): PathExpression {
  let parts = path.split('.');

  let head: Head;
  let first = parts.shift()!;

  if (path[0] === '@') {
    head = { type: 'ArgReference', name: first.slice(1) };
  } else if (first === 'this') {
    head = { type: 'This' };
  } else {
    head = { type: 'LocalReference', name: first };
  }

  return {
    type: 'PathExpression',
    head,
    tail: parts.length ? parts : null,
  };
}

export function atPath(path: string): PathExpression {
  let parts = path.split('.');
  return {
    type: 'PathExpression',
    head: {
      type: 'ArgReference',
      name: parts[0],
    },
    tail: parts.length > 1 ? parts.slice(1) : null,
  };
}

export interface LocalReference {
  type: 'LocalReference';
  name: string;
}

export interface ArgReference {
  type: 'ArgReference';
  name: string;
}

export interface This {
  type: 'This';
}

export type Head = LocalReference | ArgReference | This;

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
  type: 'Hash';
  pairs: HashPair[];
}

export function hash(map: { [key: string]: ToHashPart }): Hash {
  let out: HashPair[] = [];

  for (let key of keys(map)) {
    out.push({ key: key as string, value: ToHashPart(map[key]) });
  }

  return { type: 'Hash', pairs: out };
}

export interface HashPair {
  key: string;
  value: Expression;
}

export interface StripFlags {
  open: boolean;
  close: boolean;
}
