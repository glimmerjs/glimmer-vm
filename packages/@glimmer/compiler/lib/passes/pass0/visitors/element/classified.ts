import { ExpressionContext, Option, PresentArray } from '@glimmer/interfaces';
import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
import { getAttrNamespace } from '../../../../utils';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../pass1/ops';
import { Source } from '../../../shared/op';
import { Err, Ok, Result, ResultArray } from '../../../shared/result';
import { Context } from '../../context';
import { buildHash, buildParams } from '../../utils/builders';
import { assertIsSimpleHelper, isHelperInvocation, isTrustingNode } from '../../utils/is-node';
import { dynamicAttrValue } from './element-node';
import { TemporaryNamedBlock } from './temporary-block';

export type ValidAttr = pass1.Attr | pass1.AttrSplat;

type ProcessedAttributes = {
  attrs: ValidAttr[];
  args: pass1.AnyNamedArguments;
};

export interface Classified<Body> {
  readonly dynamicFeatures: boolean;

  arg(attr: AST.AttrNode, classified: ClassifiedElement<Body>): Result<pass1.NamedArgument>;
  toStatement(classified: ClassifiedElement<Body>, prepared: PreparedArgs<Body>): pass1.Statement;
  selfClosing(block: pass1.NamedBlock, classified: ClassifiedElement<Body>): Result<Body>;
  namedBlock(block: pass1.NamedBlock, classified: ClassifiedElement<Body>): Result<Body>;
  namedBlocks(
    blocks: PresentArray<pass1.NamedBlock>,
    classified: ClassifiedElement<Body>
  ): Result<Body>;
}

export class ClassifiedElement<Body> {
  readonly delegate: Classified<Body>;

  constructor(
    readonly element: AST.ElementNode,
    delegate: Classified<Body>,
    readonly ctx: Context
  ) {
    this.delegate = delegate;
  }

  toStatement(): Result<pass1.Statement> {
    return this.prepare().mapOk((prepared) => this.delegate.toStatement(this, prepared));
  }

  private attr(attr: AST.AttrNode): Result<ValidAttr> {
    let name = attr.name;
    let rawValue = attr.value;

    let namespace = getAttrNamespace(name) || undefined;
    let value = dynamicAttrValue(this.ctx, rawValue);

    let isTrusting = isTrustingNode(attr.value);

    // splattributes
    // this is grouped together with attributes because its position matters
    if (name === '...attributes') {
      return Ok(this.ctx.op(pass1.AttrSplat).loc(attr));
    }

    return Ok(
      this.ctx
        .op(pass1.Attr, {
          name: this.ctx.slice(name).offsets(null),
          value: value,
          namespace,
          kind: {
            trusting: isTrusting,
            component: this.delegate.dynamicFeatures,
          },
        })
        .loc(attr)
    );
  }

  private modifier(modifier: AST.ElementModifierStatement): pass1.Modifier {
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

  private attrs(): Result<ProcessedAttributes> {
    let attrs = new ResultArray<ValidAttr>();
    let args = new ResultArray<pass1.NamedArgument>();

    let typeAttr: Option<AST.AttrNode> = null;

    for (let attr of this.element.attributes) {
      if (attr.name === 'type') {
        typeAttr = attr;
      } else if (attr.name[0] === '@') {
        args.add(this.delegate.arg(attr, this));
      } else {
        attrs.add(this.attr(attr));
      }
    }

    if (typeAttr) {
      attrs.add(this.attr(typeAttr));
    }

    return Result.all(args.toArray(), attrs.toArray()).mapOk(([args, attrs]) => ({
      attrs,
      args: pass1.AnyNamedArguments(args),
    }));
  }

  private body(): Result<Body> {
    let { element, ctx } = this;

    return ctx.withBlock(element, (child) =>
      ctx.visitAmbiguousStmts(element.children).andThen((statements) => {
        let temp = new TemporaryNamedBlock(
          {
            name: ctx.slice('default').offsets(null),
            table: child,
            body: statements,
          },
          new Source(ctx.source).maybeOffsetsFor(element)
        );

        if (temp.isValidNamedBlock()) {
          let block = temp.asNamedBlock();

          if (element.selfClosing) {
            return this.delegate.selfClosing(block, this);
          } else {
            return this.delegate.namedBlock(block, this);
          }
        } else if (temp.hasValidNamedBlocks()) {
          return temp
            .asNamedBlocks(ctx.source)
            .andThen((blocks) => this.delegate.namedBlocks(blocks, this));
        } else {
          return Err(
            new GlimmerSyntaxError(
              `an element cannot have semantic content *and* named blocks`,
              this.element.loc
            )
          );
        }
      })
    );
  }

  private prepare(): Result<PreparedArgs<Body>> {
    let result = this.attrs();

    return result.andThen((result) => {
      let { attrs, args } = result;

      let modifiers = this.element.modifiers.map((m) => this.modifier(m));
      let params = pass1.AnyElementParameters([...attrs, ...modifiers]);

      return this.body().mapOk((body) => ({ args, params, body }));
    });
  }
}

export interface PreparedArgs<Body> {
  args: pass1.AnyNamedArguments;
  params: pass1.AnyElementParameters;
  body: Body;
}
