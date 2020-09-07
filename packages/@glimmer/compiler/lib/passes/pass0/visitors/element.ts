import { ExpressionContext, Option, PresentArray } from '@glimmer/interfaces';
import { AST, builders, GlimmerSyntaxError, SourceLocation } from '@glimmer/syntax';
import { assertPresent, assign, ifPresent, isPresent, mapPresent } from '@glimmer/util';
import { getAttrNamespace } from '../../../utils';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../pass1/ops';
import { SymbolTable } from '../../shared/symbol-table';
import { Context } from '../context';
import { EXPR_KEYWORDS } from '../keywords/exprs';
import { buildArgs, buildHash, buildParams, buildPathWithContext } from '../utils/builders';
import {
  assertIsSimpleHelper,
  isHelperInvocation,
  isSimplePath,
  isTrustingNode,
} from '../utils/is-node';

export function ElementNode(
  element: AST.ElementNode,
  ctx: Context
): Result<pass1.Statement | pass1.NamedBlock | pass1.TemporaryNamedBlock> {
  // Named blocks are special. When we see them, we return a TemporaryNamedBlock, which
  // are only allowed directly inside a component invocation, and only if there is no
  // other semantic content alongside the named block. Any other context that sees a
  // TemporaryNamedBlock produces a syntax error.
  if (isNamedBlock(element)) {
    return Ok(
      ctx.withBlock(element, (child) => {
        return ctx
          .op(pass1.TemporaryNamedBlock, {
            name: ctx.slice(element.tag.slice(1)).loc(element),
            table: child,
            body: ctx.mapIntoOps(element.children, (stmt) => ctx.visitStmt(stmt)),
          })
          .loc(element);
      })
    );
  }

  let classified = classify(ctx, element);
  return classified.toStatement();
}

type ClassifiedBody =
  | {
      type: 'named-block';
      block: pass1.NamedBlock;
    }
  | {
      type: 'named-blocks';
      blocks: PresentArray<pass1.NamedBlock>;
    };

export type ValidAttr = pass1.Attr | pass1.AttrSplat;

function simpleDynamicAttrValue(
  ctx: Context,
  value: AST.MustacheStatement | AST.TextNode
): pass1.Expr {
  // returns the static value if the value is static
  if (value.type === 'TextNode') {
    return ctx.op(pass1.Literal, { value: value.chars }).loc(value);
  }

  if (EXPR_KEYWORDS.match(value)) {
    return EXPR_KEYWORDS.translate(value, ctx);
  }

  if (isHelperInvocation(value)) {
    assertIsSimpleHelper(value, value.loc, 'helper');

    return ctx
      .op(
        pass1.SubExpression,
        assign(
          {
            head: ctx.visitExpr(value.path, ExpressionContext.CallHead),
          },
          buildArgs(ctx, value)
        )
      )
      .loc(value);
  }

  switch (value.path.type) {
    case 'PathExpression': {
      if (isSimplePath(value.path)) {
        // x={{simple}}
        return buildPathWithContext(ctx, value.path, ExpressionContext.AppendSingleId);
      } else {
        // x={{simple.value}}

        return buildPathWithContext(ctx, value.path, ExpressionContext.Expression);
      }
    }

    default: {
      return ctx.visitExpr(value.path);
    }
  }
}

export function dynamicAttrValue(
  ctx: Context,
  value: AST.TextNode | AST.MustacheStatement | AST.ConcatStatement
): pass1.Expr {
  if (value.type === 'ConcatStatement') {
    let exprs = mapPresent(assertPresent(value.parts), (part) => dynamicAttrValue(ctx, part));

    return ctx.op(pass1.Concat, { parts: exprs }).loc(value);
  }

  return simpleDynamicAttrValue(ctx, value);
}

function assertValidArgumentName(
  attribute: AST.AttrNode,
  isComponent: boolean,
  elementNode: AST.ElementNode
) {
  if (!isComponent && attribute.name[0] === '@') {
    throw new GlimmerSyntaxError(
      `${attribute.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${elementNode.tag}\`) is a regular, non-component HTML element.`,
      attribute.loc
    );
  }
}

function assertNoNamedBlocks(
  body: ClassifiedBody,
  el: ClassifiedElement | ClassifiedComponent,
  loc: SourceLocation
): asserts body is { type: 'named-block'; block: pass1.NamedBlock } {
  if (body.type === 'named-blocks' && !(el instanceof ClassifiedComponent)) {
    throw new GlimmerSyntaxError(`Named blocks are only allowed inside a component`, loc);
  }
}

function isNamedBlock(element: AST.ElementNode): boolean {
  return element.tag[0] === ':';
}

type ElementKind = 'Variable' | 'Uppercase' | 'Element';

function isUpperCase(tag: string): boolean {
  return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
}

function classifyTag(variable: string, currentSymbols: SymbolTable): ElementKind {
  if (variable[0] === '@' || variable === 'this' || currentSymbols.has(variable)) {
    return 'Variable';
  } else if (isUpperCase(variable)) {
    return 'Uppercase';
  } else {
    return 'Element';
  }
}

type ProcessedAttributes = {
  attrs: ValidAttr[];
  args: pass1.AnyNamedArguments;
};

// let outAttrs: pass1.ElementParameter[] = attrNodes.map((a) =>
//   attr(ctx, a, classified.dynamicFeatures, element)
// );

abstract class ResultImpl<T> {
  abstract ifOk<U>(callback: (value: T) => U): Result<U>;
  abstract readonly isOk: boolean;
  abstract readonly isErr: boolean;
}

class OkImpl<T> extends ResultImpl<T> {
  readonly isOk = true;
  readonly isErr = false;

  constructor(readonly value: T) {
    super();
  }

  ifOk<U>(callback: (value: T) => U): Result<U> {
    return Ok(callback(this.value));
  }
}

class ErrImpl<T> extends ResultImpl<T> {
  readonly isOk = false;
  readonly isErr = true;

  constructor(readonly reason: GlimmerSyntaxError) {
    super();
  }

  ifOk<U>(_callback: (value: T) => U): Result<U> {
    return this.cast<U>();
  }

  cast<U>(): Result<U> {
    return (this as unknown) as Result<U>;
  }
}

export type Result<T> = OkImpl<T> | ErrImpl<T>;

export function Ok<T>(value: T): Result<T> {
  return new OkImpl(value);
}

export function Err<T>(reason: GlimmerSyntaxError): Result<T> {
  return new ErrImpl(reason);
}

class ResultArray<T> {
  private items: Result<T>[] = [];

  add(item: Result<T>): void {
    this.items.push(item);
  }

  toArray(): Result<T[]> {
    let err = this.items.find((item): item is ErrImpl<T> => item instanceof ErrImpl);

    if (err !== undefined) {
      return err.cast<T[]>();
    } else {
      return Ok((this.items as OkImpl<T>[]).map((item) => item.value));
    }
  }
}

abstract class Classified {
  abstract readonly dynamicFeatures: boolean;
  abstract readonly isComponent: boolean;

  constructor(readonly element: AST.ElementNode, readonly ctx: Context) {}

  abstract arg(attr: AST.AttrNode): Result<pass1.NamedArgument>;
  abstract toStatement(): Result<pass1.Statement>;

  params(attrs: ValidAttr[]): pass1.AnyElementParameters {
    let modifiers = this.modifiers();

    let paramList = [...attrs, ...modifiers];
    return ifPresent(
      paramList,
      (list) => this.ctx.op(pass1.ElementParameters, { body: list }),
      () => this.ctx.op(pass1.EmptyElementParameters)
    ).offsets(null);
  }

  attr(attr: AST.AttrNode): ValidAttr {
    assertValidArgumentName(attr, this.dynamicFeatures, this.element);

    let name = attr.name;
    let rawValue = attr.value;

    let namespace = getAttrNamespace(name) || undefined;
    let value = dynamicAttrValue(this.ctx, rawValue);

    let isTrusting = isTrustingNode(attr.value);

    // splattributes
    // this is grouped together with attributes because its position matters
    if (name === '...attributes') {
      return this.ctx.op(pass1.AttrSplat).loc(attr);
    }

    return this.ctx
      .op(pass1.Attr, {
        name: this.ctx.slice(name).offsets(null),
        value: value,
        namespace,
        kind: {
          trusting: isTrusting,
          component: this.dynamicFeatures,
        },
      })
      .loc(attr);
  }

  modifier(modifier: AST.ElementModifierStatement): pass1.Modifier {
    if (isHelperInvocation(modifier)) {
      assertIsSimpleHelper(modifier, modifier.loc, 'modifier');
    }

    return this.ctx
      .op(pass1.Modifier, {
        head: this.ctx.visitExpr(modifier.path, ExpressionContext.ModifierHead),
        params: buildParams(this.ctx, { path: modifier.path, params: modifier.params }),
        hash: buildHash(this.ctx, modifier.hash),
      })
      .loc(modifier);
  }

  modifiers() {
    return this.ctx.mapIntoOps(this.element.modifiers, (statement) => this.modifier(statement));
  }

  attrs(): Result<ProcessedAttributes> {
    let attrs: ValidAttr[] = [];
    let args = new ResultArray<pass1.NamedArgument>();

    let typeAttr: Option<AST.AttrNode> = null;

    for (let attr of this.element.attributes) {
      if (attr.name === 'type') {
        typeAttr = attr;
      } else if (attr.name[0] === '@') {
        args.add(this.arg(attr));
      } else {
        attrs.push(this.attr(attr));
      }
    }

    if (typeAttr) {
      attrs.push(this.attr(typeAttr));
    }

    return args.toArray().ifOk((args) => ({
      attrs,
      args: pass1.AnyNamedArguments(args),
    }));
  }
}

class ClassifiedElement extends Classified {
  readonly isComponent = false;

  constructor(
    element: AST.ElementNode,
    context: Context,
    readonly tag: pass1.SourceSlice,
    readonly dynamicFeatures: boolean
  ) {
    super(element, context);
  }

  body(block: pass1.TemporaryNamedBlock): Result<pass1.NamedBlock> {
    if (block.isValidNamedBlock()) {
      return Ok(block.asNamedBlock());
    } else if (block.hasValidNamedBlocks()) {
      return Err(
        new GlimmerSyntaxError(
          `only a component can have named blocks, and this is a ${this.element.tag}`,
          this.element.loc
        )
      );
    } else {
      // there were semantic children and named blocks
      return Err(
        new GlimmerSyntaxError(
          `a component cannot have semantic content and named blocks`,
          this.element.loc
        )
      );
    }
  }

  arg(attr: AST.AttrNode): Result<pass1.NamedArgument> {
    return Err(
      new GlimmerSyntaxError(
        `${attr.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${this.element.tag}\`) is a regular, non-component HTML element.`,
        attr.loc
      )
    );
  }

  toStatement(): Result<pass1.SimpleElement> {
    let result = this.attrs();

    if (result.isErr) {
      throw result.reason;
    }

    let { attrs } = result.value;
    let params = this.params(attrs);

    let block = this.ctx.withBlock(this.element, (child) => {
      let body = this.ctx.mapIntoOps(this.element.children, (stmt) =>
        this.ctx.visitAmbiguousStmt(stmt)
      );
      let block = this.ctx
        .op(pass1.TemporaryNamedBlock, {
          name: this.ctx.slice('default').offsets(null),
          table: child,
          body,
        })
        .loc(this.element);
      return this.body(block);
    });

    return block.ifOk((body) => {
      return this.ctx
        .op(pass1.SimpleElement, {
          tag: this.tag,
          params,
          body,
          dynamicFeatures: this.dynamicFeatures,
        })
        .loc(this.element);
    });
  }
}

class ClassifiedComponent extends Classified {
  readonly dynamicFeatures = true;
  readonly isComponent = true;

  constructor(element: AST.ElementNode, context: Context, readonly tag: pass1.Expr) {
    super(element, context);
  }

  body(block: pass1.TemporaryNamedBlock): Result<pass1.NamedBlocks> {
    if (block.isValidNamedBlock()) {
      return Ok(this.ctx.op(pass1.NamedBlocks, { blocks: [block.asNamedBlock()] }).offsets(block));
    } else if (block.hasValidNamedBlocks()) {
      let children = block.asNamedBlocks(this.ctx.source);

      return children.ifOk((blocks) => this.ctx.op(pass1.NamedBlocks, { blocks }).offsets(blocks));
    } else {
      // there were semantic children and named blocks
      return Err(
        new GlimmerSyntaxError(
          `a component cannot have semantic content and named blocks`,
          this.element.loc
        )
      );
    }
  }

  arg(attr: AST.AttrNode): Result<pass1.NamedArgument> {
    assertValidArgumentName(attr, this.dynamicFeatures, this.element);

    let name = attr.name;
    let nameSlice = this.ctx.slice(name).offsets(null);

    let value = dynamicAttrValue(this.ctx, attr.value);

    return Ok(
      this.ctx
        .op(pass1.NamedArgument, {
          key: nameSlice,
          value,
        })
        .loc(attr)
    );
  }

  toStatement(): Result<pass1.Component> {
    let loc = this.element;

    let result = this.attrs();

    if (result.isErr) {
      throw result.reason;
    }

    let { attrs, args } = result.value;
    let elementParams = this.params(attrs);

    let blocks: Result<pass1.AnyNamedBlocks>;

    if (this.element.selfClosing) {
      blocks = Ok(this.ctx.op(pass1.EmptyNamedBlocks).loc(loc));
    } else {
      blocks = this.ctx.withBlock(this.element, (child) => {
        let body = this.ctx.mapIntoOps(this.element.children, (stmt) =>
          this.ctx.visitAmbiguousStmt(stmt)
        );
        let block = this.ctx
          .op(pass1.TemporaryNamedBlock, {
            name: this.ctx.slice('default').offsets(null),
            table: child,
            body,
          })
          .loc(loc);
        return this.body(block);
      });
    }

    return blocks.ifOk((blocks) =>
      this.ctx
        .op(pass1.Component, {
          tag: this.tag,
          params: elementParams,
          args,
          blocks,
        })
        .loc(loc)
    );
  }
}

function classify(ctx: Context, element: AST.ElementNode): ClassifiedElement | ClassifiedComponent {
  // this code is parsing the expression at the head of component, which
  // is not done by @glimmer/syntax, and notably is scope-sensitive.

  let { tag, loc, attributes, modifiers } = element;

  let [maybeLocal, ...rest] = tag.split('.');

  let kind = classifyTag(maybeLocal, ctx.symbols.current);

  let path: AST.PathExpression;

  switch (kind) {
    case 'Element':
      return new ClassifiedElement(
        element,
        ctx,
        ctx.slice(tag).loc(loc),
        hasDynamicFeatures({ attributes, modifiers })
      );

    case 'Uppercase':
      return new ClassifiedComponent(
        element,
        ctx,
        ctx
          .op(pass1.GetVar, {
            name: ctx.slice(ctx.customizeComponentName(tag)).offsets(null),
            context: ExpressionContext.ComponentHead,
          })
          .loc(loc)
      );

    case 'Variable':
      path = builders.fullPath(builders.head(maybeLocal), rest);
      break;
  }

  return new ClassifiedComponent(
    element,
    ctx,
    ctx.visitExpr(path, ExpressionContext.ComponentHead)
  );
}

function hasDynamicFeatures({
  attributes,
  modifiers,
}: Pick<AST.ElementNode, 'attributes' | 'modifiers'>): boolean {
  // ElementModifier needs the special ComponentOperations
  if (modifiers.length > 0) {
    return true;
  }

  // Splattributes need the special ComponentOperations to merge into
  return !!attributes.find((attr) => attr.name === '...attributes');
}
