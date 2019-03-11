import { keys, join } from '@glimmer/util';
import * as hbs from '../types/handlebars-ast';
import { Option } from '@glimmer/interfaces';

export class AstBuilder {
  private pos = 0;
  private out = '';

  build(program: BuilderAst): { root: hbs.Root; source: string } {
    let statements: hbs.Statement[] = [];

    let root = this.spanned(() => {
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

    return { root, source: this.out };
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

      case 'HtmlCommentStatement': {
        return this.spanned(() => {
          this.consume('<!--');
          this.consume(statement.value);
          this.consume('-->');

          return span => ({
            type: 'HtmlCommentNode',
            span,
            value: statement.value,
          });
        });
      }

      case 'TextNode': {
        return this.text(statement);
      }

      case 'BlockStatement':
        return this.spanned(() => {
          this.consume('{{#');

          let programs = this.programs(statement.programs, statement.mustache.contents);

          if (programs.callString === null) {
            throw new Error(`unexpected empty {{#}}`);
          }

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
            this.consume(programs.callString);
          }

          this.consume('}}');

          return span => ({
            type: 'BlockStatement',
            span,
            program: programs.default,
            inverses: programs.else,
          });
        });

      case 'Element':
        return this.element(statement);

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

  element(item: ElementNode): hbs.ElementNode {
    let start = this.pos;
    this.consume('<');
    let tag = this.expr(item.tag);
    let i = 0;

    if (item.parts) {
      let needsWs = true;
      let attributes: hbs.AttrNode[] = [];

      let parts = item.parts;
      loop: for (; i < parts.length; i++) {
        let part = parts[i];

        switch (part.type) {
          case 'Whitespace': {
            needsWs = false;
            this.consume(part.body);
            break;
          }

          case 'AttrNode': {
            if (needsWs) {
              this.consume(' ');
            }

            needsWs = true;
            let { name, parts } = part;

            let node = this.spanned(() => {
              let nameSpan = this.consume(name);
              let value = this.attribute(parts);

              return span => ({
                type: 'AttrNode',
                span,
                name: {
                  type: 'PathSegment',
                  span: nameSpan,
                  name: name,
                },
                value,
              });
            });

            attributes.push(node);
            break;
          }

          case 'Program':
            break loop;
        }
      }

      this.consume('>');

      let body: Option<hbs.Program> = null;

      for (; i < parts.length; i++) {
        let part = parts[i];

        switch (part.type) {
          case 'AttrNode':
          case 'Whitespace': {
            throw new Error(`${part.type} not allowed after the body`);
          }

          case 'Program': {
            if (body !== null) {
              throw new Error(`Only one body is allowed per element`);
            }

            body = this.program(part, null);
          }
        }
      }

      this.consume('</');
      this.expr(item.tag);
      this.consume('>');

      return {
        type: 'ElementNode',
        span: { start, end: this.pos },
        tag,
        attributes: attributes.length ? attributes : null,
        blockParams: null,
        modifiers: null,
        comments: null,
        body,
      };
    } else {
      throw new Error(`unimplemented element without parts`);
    }
  }

  attribute(parts: Option<AttrPart[]>): hbs.AttrValue {
    if (parts === null) return null;

    let needsEqual = true;
    let attrValue: Option<hbs.AttrValue> = null;

    for (let part of parts) {
      switch (part.type) {
        case 'Equals': {
          this.consume('=');
          needsEqual = false;
          break;
        }

        case 'Whitespace': {
          this.consume(part.body);
          break;
        }

        case 'ConcatNode':
        case 'MustacheStatement':
        case 'TextNode': {
          if (needsEqual) {
            this.consume('=');
            needsEqual = false;
          }

          attrValue = this.attrValue(part);
        }
      }
    }

    return attrValue;
  }

  program(program: Program, callBody: hbs.CallBody | null): hbs.Program {
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
      });
    });
  }

  inverse(inverse: Inverse): hbs.Program {
    this.consume('{{else');

    let inside: InsideMustache | null;
    if (inverse.mustache.contents.length) {
      this.consume(' ');
      inside = this.insideMustache(inverse.mustache.contents);
    } else {
      inside = null;
    }

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
      });
    });
  }

  programs(
    programs: ToProgramPart[],
    callBody: MustacheContent[]
  ): {
    default: hbs.Program;
    else: Option<hbs.Program[]>;
    close: Option<CloseBlock>;
    callString: string | null;
  } {
    let defaultBlock: hbs.Program | null = null;
    let inverseBlocks: hbs.Program[] = [];
    let close: Option<CloseBlock> = null;
    let currentBlock: hbs.Program | null = null;

    let inside = this.insideMustache(callBody);

    this.consume('}}');
    let start = this.pos;

    for (let part of programs) {
      if (part.type === 'SkippedWhitespace') {
        this.skip(part.body);
        continue;
      } else if (part.type === 'Program') {
        defaultBlock = this.program(part, inside && inside.body);
        defaultBlock.span.start = start;
        currentBlock = defaultBlock;
        start = this.pos;
      } else if (part.type === 'Else') {
        currentBlock!.span.end = this.pos;
        currentBlock = this.inverse(part);
        inverseBlocks.push(currentBlock);
      } else if (part.type === 'CloseBlock') {
        close = part;
      }
    }

    if (currentBlock === null || defaultBlock === null) {
      throw new Error(`Must pass at least one block to blockCall`);
    }

    return {
      default: defaultBlock,
      else: inverseBlocks.length ? inverseBlocks : null,
      close,
      callString: inside ? inside.callString : null,
    };
  }

  attrValue(statement: AttributeValue): hbs.AttrValue {
    if (statement === null) {
      return null;
    }

    switch (statement.type) {
      case 'MustacheStatement':
        return this.mustache(statement);
      case 'TextNode': {
        if (statement.quoted) this.consume('"');
        let text = this.text(statement);
        if (statement.quoted) this.consume('"');
        return text;
      }
      case 'ConcatNode': {
        return this.concat(statement);
      }
    }
  }

  concat(statement: ConcatNode): hbs.ConcatStatement {
    return this.spanned<hbs.ConcatStatement>(() => {
      this.consume('"');
      let parts = statement.parts.map(p => {
        switch (p.type) {
          case 'MustacheStatement': {
            return this.mustache(p);
          }

          case 'TextNode': {
            return this.text(p);
          }
        }
      });

      this.consume('"');

      return span => ({
        type: 'ConcatStatement',
        span,
        parts,
      });
    });
  }

  text(statement: TextNode): hbs.TextNode {
    let span = this.consume(statement.value);

    return {
      type: 'TextNode',
      span,
      value: statement.value,
    };
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

  insideMustache(contents: MustacheContents): InsideMustache | null {
    let foundCall: { call: hbs.Expression; string: string } | undefined = undefined;
    let foundHash: hbs.Hash | null | undefined = undefined;
    let params: hbs.Expression[] = [];
    let blockParams: Option<hbs.BlockParams> = null;
    let last: number = this.pos;
    let needsWs = false;

    for (let param of contents) {
      if (param.type !== 'Whitespace' && needsWs) {
        this.consume(' ');
        needsWs = false;
      }

      if (param.type === 'Pipes') {
        this.consume('as');
        let start: Option<number> = null;
        let end: Option<number> = null;
        let segments = [];

        for (const part of param.parts) {
          if (typeof part === 'string') {
            let segment = this.spanned(() => {
              this.consume(part);

              return span => ({
                type: 'PathSegment',
                span,
                name: part,
              });
            });

            segments.push(segment);
          } else if (part.type === 'Pipe') {
            if (start === null) {
              start = this.pos;
              this.consume('|');
            } else if (end === null) {
              this.consume('|');
              end = this.pos;
            } else {
              throw new Error(`Only two pipes are allowed in a pipes()`);
            }
          } else if (part.type === 'Whitespace') {
            this.consume(part.body);
          }
        }

        if (start === null || end === null) {
          throw new Error(`Block params must contain a starting and ending point`);
        }

        blockParams = {
          type: 'BlockParams',
          span: { start, end },
          params: segments,
        };
        last = this.pos;
        continue;
      }

      if (foundCall === undefined && param.type !== 'Whitespace') {
        if (param.type === 'Hash') {
          throw new Error(`The first element of a mustache may not be a hash`);
        }

        let call = this.expr(param);
        foundCall = { call, string: this.out.slice(call.span.start, call.span.end) };
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
      callString: foundCall.string,
      body: {
        type: 'CallBody',
        span: { start: foundCall.call.span.start, end: last },
        call: foundCall.call,
        params: params.length ? params : null,
        hash: foundHash || null,
        blockParams,
      },
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
    this.out += chars;
    return { start: pos, end: this.pos };
  }

  skip(chars: string): void {
    this.out += chars;
    this.pos += chars.length;
  }

  spanned<T extends hbs.AnyNode>(cb: () => (span: hbs.Span) => T): T {
    let pos = this.pos;

    let next = cb();
    return next({ start: pos, end: this.pos });
  }
}

interface InsideMustache {
  callString: string;
  body: hbs.CallBody;
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

export interface Pipe {
  type: 'Pipe';
}

export interface Pipes {
  type: 'Pipes';
  parts: Array<Whitespace | Pipe | string>;
}

export function as(...parts: string[]): Pipes {
  let out = join(parts, ws);

  return {
    type: 'Pipes',
    parts: [ws(), pipe(), ...out, pipe()],
  };
}

export function pipe(): Pipe {
  return {
    type: 'Pipe',
  };
}

export function pipes(...parts: Array<Whitespace | Pipe | string>): Pipes {
  return {
    type: 'Pipes',
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
  | ElementNode
  | TextNode
  | CommentStatement
  | HtmlCommentStatement
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

export interface ModifierStatement {
  type: 'ModifierStatement';
  contents: MustacheContents;
  trusted: boolean;
  strip?: StripFlags;
}

export type BuilderMustache = MustacheStatement;

export type MustacheContent = Expression | Hash | Pipes;
export type ToMustachePart = MustacheContent | Pipes | string | boolean | number | null | undefined;
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
    return { type: 'TextNode', value };
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

export function modifier(...params: ToMustachePart[]): ModifierStatement {
  let parts = params.map(ToMustachePart);

  return {
    type: 'ModifierStatement',
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
  };
}

export interface Component {
  type: 'Component';
  mustache: MustacheStatement;
  programs: ToProgramPart[];
}

export function component(
  mustacheParts: ToMustachePart[],
  ...programs: ToProgramPart[]
): Component {
  return {
    type: 'Component',
    mustache: mustache(...mustacheParts),
    programs,
  };
}

export type AttributeValue = TextNode | MustacheStatement | ConcatNode;
export type ConcatValue = TextNode | MustacheStatement;

export interface Equals {
  type: 'Equals';
}

export const eq: Equals = { type: 'Equals' };

export type AttrPart = Whitespace | Equals | AttributeValue;

export interface AttrNode {
  type: 'AttrNode';
  name: string;
  parts: Option<AttrPart[]>;
}

export function attr(name: string, ...parts: AttrPart[]): AttrNode {
  return {
    type: 'AttrNode',
    name,
    parts: parts.length ? parts : null,
  };
}

export interface ElementNode {
  type: 'Element';
  tag: PathExpression;
  parts: ElementPart[];
}

export type ElementPart = AttrNode | ModifierStatement | Program | Whitespace;

export function element(tag: string, ...parts: ElementPart[]): ElementNode {
  return {
    type: 'Element',
    tag: path(tag),
    parts,
  };
}

export interface TextNode {
  type: 'TextNode';
  value: string;
  quoted?: boolean;
}

export function text(value: string): TextNode {
  return {
    type: 'TextNode',
    value,
  };
}

export function quoted(value: string): TextNode {
  return {
    type: 'TextNode',
    value,
    quoted: true,
  };
}

export interface ConcatNode {
  type: 'ConcatNode';
  parts: ConcatValue[];
}

export function concat(...parts: ConcatValue[]): ConcatNode {
  return {
    type: 'ConcatNode',
    parts,
  };
}

export interface CommentStatement {
  type: 'CommentStatement';
  value: string;
  block: boolean;
}

export interface HtmlCommentStatement {
  type: 'HtmlCommentStatement';
  value: string;
}

export function htmlComment(value: string): HtmlCommentStatement {
  return {
    type: 'HtmlCommentStatement',
    value,
  };
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
