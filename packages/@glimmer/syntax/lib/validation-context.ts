import type { Optional, PresentArray } from '@glimmer/interfaces';
import { localAssert } from '@glimmer/debug-util';

import type { SourceSpan } from './source/loc/span';
import type { HasSourceSpan } from './source/span-list';
import type { PathSyntaxType } from './v2/api';

import { loc } from './source/span-list';
import { describeUnresolvedError, describeUnresolvedItem } from './v2/api';

export type OuterContext = ContentValidationContext | OuterExpressionValidationContext;
export type ValidationContext =
  | ContentValidationContext
  | OuterExpressionValidationContext
  | PathValidationContext;
export type { OuterExpressionValidationContext, PathValidationContext };

interface ContextDelegate {
  readonly content: SourceSpan;
  upsertOuterExpr(outer: HasSourceSpan): OuterExpressionValidationContext;
  withPath(path: HasSourceSpan, head: HasSourceSpan, syntax: PathSyntaxType): PathValidationContext;
}

abstract class AbstractValidationContext {
  readonly #delegate: ContextDelegate;

  constructor(delegate: ContextDelegate) {
    this.#delegate = delegate;
  }

  get content(): SourceSpan {
    return this.#delegate.content;
  }

  upsertOuterExpr(outer: HasSourceSpan): OuterExpressionValidationContext {
    return this.#delegate.upsertOuterExpr(outer);
  }

  withPath(
    path: HasSourceSpan,
    head: HasSourceSpan,
    syntax: PathSyntaxType
  ): PathValidationContext {
    const pathSpan = loc(path);
    const headSpan = loc(head);

    localAssert(isContained(this.#delegate.content, pathSpan), `path must be contained in content`);
    localAssert(isContained(pathSpan, headSpan), `path head must be contained in path`);

    return this.#delegate.withPath(path, head, syntax);
  }

  withPathHead(path: HasSourceSpan, syntax: PathSyntaxType): PathValidationContext {
    return this.#delegate.upsertOuterExpr(path).withPath(path, path, syntax);
  }

  withPathNode(
    path: HasSourceSpan & { head: HasSourceSpan },
    syntax: PathSyntaxType
  ): PathValidationContext {
    return this.#delegate.withPath(path, path.head, syntax);
  }

  replaceOuterExpr(outer: HasSourceSpan): OuterExpressionValidationContext {
    return OuterExpressionValidationContext.of(this.#delegate.content, loc(outer));
  }
}

export type ValidationContentType =
  | 'component'
  | 'element'
  | 'block'
  | 'attr'
  | 'arg'
  | 'modifier'
  | 'content'
  | { custom: string };

export class ContentValidationContext extends AbstractValidationContext {
  static of(statement: HasSourceSpan, type: ValidationContentType) {
    return new ContentValidationContext(loc(statement), type);
  }

  readonly kind = 'content';
  readonly type: ValidationContentType;

  private constructor(statement: SourceSpan, type: ValidationContentType) {
    super({
      content: statement,
      upsertOuterExpr: (outer: HasSourceSpan) => this.replaceOuterExpr(outer),
      withPath: (path: HasSourceSpan, head: HasSourceSpan, syntax: PathSyntaxType) =>
        OuterExpressionValidationContext.of(this.content, loc(path)).withPath(path, head, syntax),
    });
    this.type = type;
  }

  get loc() {
    return this.content;
  }

  withOuter(outer: HasSourceSpan): OuterExpressionValidationContext {
    return OuterExpressionValidationContext.of(this.content, loc(outer));
  }
}

/**
 * The "outer expression" is the outer-most expression inside of the content item that is being
 * processed.
 *
 * This can include:
 *
 * - a call expression `(x y)` in `{{(x y)}}`
 * - positional arguments (`y z`) in `{{x y z}}`
 * - a specific named argument (`y=z`) in `{{x y=z}}`
 */
class OuterExpressionValidationContext extends AbstractValidationContext {
  static of(content: HasSourceSpan, outer: HasSourceSpan): OuterExpressionValidationContext {
    return new OuterExpressionValidationContext(loc(content), loc(outer));
  }

  readonly kind = 'expr';
  readonly outer: SourceSpan;

  private constructor(content: SourceSpan, outer: SourceSpan) {
    super({
      content: loc(content),
      upsertOuterExpr: (outer: HasSourceSpan) =>
        OuterExpressionValidationContext.of(this.content, loc(outer)),
      withPath: (path: HasSourceSpan, head: HasSourceSpan, syntax: PathSyntaxType) =>
        new PathValidationContext({
          content: this.content,
          outer: this.outer,
          path: loc(path),
          head: loc(head),
          type: syntax,
        }),
    });
    this.outer = outer;
  }

  get loc() {
    return this.outer;
  }
}

/**
 * A "path expression" is an expression that references a specific path inside of a content item.
 *
 * When producing a syntax error for a variable that is not in scope, it should be the closest path
 * to the variable that is not in scope.
 *
 * If the path is only a single bare identifier, then the callee should be `undefined`. Otherwise,
 * the `callee` should represent the span of code for the variable reference, and the `path` should
 * represent the span of code for the entire path.
 */
class PathValidationContext extends AbstractValidationContext {
  readonly outer: Optional<SourceSpan>;
  readonly path: SourceSpan;
  readonly head: Optional<SourceSpan>;
  readonly type: PathSyntaxType;
  notes: string[] = [];

  readonly kind = 'path';

  constructor({
    content,
    path,
    head,
    outer,
    type,
  }: {
    content: SourceSpan;
    path: SourceSpan;
    head?: Optional<SourceSpan>;
    outer?: Optional<SourceSpan>;
    type: PathSyntaxType;
  }) {
    const pathSpan = loc(path);
    const headSpan = head && loc(head);

    localAssert(isContained(content, pathSpan), `path must be contained in content`);
    localAssert(
      !headSpan || isContained(pathSpan, headSpan),
      `path head must be contained in path`
    );
    localAssert(!headSpan || !pathSpan.isEqual(headSpan), `path head must not be the same as path`);

    super({
      content,
      upsertOuterExpr: (outer: HasSourceSpan) =>
        OuterExpressionValidationContext.of(loc(content), this.outer ?? loc(outer)),
      withPath: (path: HasSourceSpan, head: HasSourceSpan, syntax: PathSyntaxType) =>
        new PathValidationContext({
          content: this.content,
          outer: this.outer,
          path: loc(path),
          head: loc(head),
          type: syntax,
        }),
    });

    this.path = path;
    this.head = head;
    this.outer = outer;
    this.type = type;
  }

  get highlightContext(): Optional<SourceSpan> {
    if (sameLine(this.content, this.path)) {
      return this.content;
    } else if (isOneLine(this.path)) {
      return this.path;
    }
  }

  get error(): string {
    return describeUnresolvedError(this.type, this.path.asString(), this.head?.asString());
  }

  get syntax(): string {
    return describeUnresolvedItem(this.type);
  }

  get loc(): SourceSpan {
    return this.head ?? this.path;
  }

  get callee(): { path: SourceSpan; head?: SourceSpan } | undefined {
    return this.head && this.head.asString() !== this.path.asString()
      ? { path: this.path, head: this.head }
      : { path: this.path };
  }

  addNotes(...notes: string[]): this {
    this.notes ??= [];
    this.notes.push(...notes);
    return this;
  }
}

// export function getPathSyntax(options: SyntaxOptions): SourceSpan {
//   return loc(options.expression?.path ?? options.expression?.outer ?? options.statement);
// }

// export function getOuterSyntax(options: SyntaxOptions): SourceSpan {
//   return loc(options.expression?.outer ?? options.statement);
// }

// export function replaceOuterExpression(
//   options: StatementOptions | ExpressionOptions,
//   expression: HasSourceSpan
// ): ExpressionOptions {
//   return { statement: options.statement, expression: { outer: loc(expression) } };
// }

// export function Stmt(statement: HasSourceSpan): StatementOptions {
//   return { statement: loc(statement) };
// }

// export function Expr(statement: HasSourceSpan, outer: HasSourceSpan): ExpressionOptions {
//   return { statement: loc(statement), expression: { outer: loc(outer) } };
// }

// export function upsertOuterExpression(
//   options: StatementOptions | ExpressionOptions,
//   expression: HasSourceSpan
// ): ExpressionOptions {
//   if ('expression' in options) {
//     return options;
//   } else {
//     return { statement: options.statement, expression: { outer: loc(expression) } };
//   }
// }

// export function withPath(options: ExpressionOptions, path: HasSourceSpan): PathOptions {
//   return {
//     statement: options.statement,
//     expression: { outer: options.expression.outer, path: loc(path) },
//   };
// }

// export function withExprAndPath(options: StatementOptions, path: HasSourceSpan): PathOptions {
//   return {
//     statement: options.statement,
//     expression: { outer: loc(path), path: loc(path) },
//   };
// }

function isContained(outer: SourceSpan, inner: SourceSpan) {
  return outer.getStart() <= inner.getStart() && outer.getEnd() >= inner.getEnd();
}

function sameLine(...spans: PresentArray<SourceSpan>) {
  const [first, ...rest] = spans;
  return (
    isOneLine(first) &&
    rest.every((span) => isOneLine(span) && span.startPosition.line === first.startPosition.line)
  );
}

function isOneLine(location: SourceSpan) {
  return location.startPosition.line === location.endPosition.line;
}
