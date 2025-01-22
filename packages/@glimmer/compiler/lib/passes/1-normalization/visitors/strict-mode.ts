import type { ASTv2, HasSourceSpan, StrictMode, ValidationContentType } from '@glimmer/syntax';
import { exhausted } from '@glimmer/debug-util';
import { ContentValidationContext, unresolvedBindingError } from '@glimmer/syntax';

import type { Result } from '../../../shared/result';

import { Err, Ok } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';

export default class ValidatorPass {
  // This is done at the end of all the keyword normalizations
  // At this point any free variables that isn't a valid keyword
  // in its context should be considered a syntax error. We
  // probably had various opportunities to do this inline in the
  // earlier passes, but this aims to produce a better syntax
  // error as we don't always have the right loc-context to do
  // so in the other spots.
  static validate(template: mir.Template, strict: boolean): Result<mir.Template> {
    return new this(template, strict).validate();
  }

  #strict: boolean;
  private template: mir.Template;

  private constructor(template: mir.Template, strict: boolean) {
    this.#strict = strict;
    this.template = template;
  }

  validate(): Result<mir.Template> {
    return this.ContentItems(this.template.body).mapOk(() => this.template);
  }

  ContentItems(statements: mir.Content[]): Result<null> {
    let result = Ok(null);

    for (let statement of statements) {
      result = result.andThen(() => this.Statement(statement));
    }

    return result;
  }

  NamedBlocks({ blocks }: mir.NamedBlocks): Result<null> {
    let result = Ok(null);

    for (let block of blocks.toArray()) {
      result = result.andThen(() => this.NamedBlock(block));
    }

    return result;
  }

  NamedBlock(block: mir.NamedBlock): Result<null> {
    return this.ContentItems(block.body);
  }

  Statement(statement: mir.Content): Result<null> {
    switch (statement.type) {
      case 'InElement':
        return this.InElement(statement);

      case 'Debugger':
        return Ok(null);

      case 'Yield':
        return this.Yield(statement);

      case 'AppendTrustedHTML':
        return this.AppendTrustedHTML(statement);

      case 'AppendValueCautiously':
        return this.AppendValueCautiously(statement);

      case 'AppendResolvedInvokableCautiously':
      case 'AppendTrustingResolvedInvokable':
        return this.AppendResolvedInvokable(statement);

      case 'ResolvedAngleBracketComponent':
      case 'AngleBracketComponent':
        return this.AngleBracketComponent(statement);

      case 'SimpleElement':
        return this.SimpleElement(statement);

      case 'InvokeBlockComponent':
      case 'InvokeResolvedBlockComponent':
        return this.InvokeBlock(statement);

      case 'AppendHtmlComment':
      case 'AppendHtmlText':
      case 'AppendStaticContent':
        return Ok(null);

      case 'IfContent':
        return this.IfContent(statement);

      case 'Each':
        return this.Each(statement);

      case 'Let':
        return this.Let(statement);

      case 'WithDynamicVars':
        return this.WithDynamicVars(statement);

      case 'InvokeComponentKeyword':
        return this.InvokeComponentKeyword(statement);

      case 'InvokeResolvedComponentKeyword':
        return this.InvokeResolvedComponentKeyword(statement);

      default:
        exhausted(statement);
    }
  }

  Expressions(
    expressions: (mir.ExpressionValueNode | ASTv2.UnresolvedBinding)[],
    context: StrictMode.OuterContext,
    syntax: ASTv2.PathSyntaxType
  ): Result<null> {
    let result = Ok(null);

    for (let expression of expressions) {
      result = result.andThen(() => this.ExpressionValue(expression, context, syntax));
    }

    return result;
  }

  CalleeExpression(
    expression: mir.CalleeExpression | mir.Missing,
    context: StrictMode.ValidationContext,
    syntax: ASTv2.PathSyntaxType
  ): Result<null> {
    if (expression.type === 'Missing' || expression.type === 'Keyword') {
      return Ok(null);
    }

    if (expression.type === 'ResolvedCallee') {
      return this.ResolvedCallee(expression, context.upsertOuterExpr(expression), syntax);
    }

    if (mir.isVariableReference(expression)) {
      return this.VariableReference(expression, context.withPathHead(expression, syntax));
    }

    if (mir.isCustomExpr(expression)) {
      return this.CustomExpression(expression, context.upsertOuterExpr(expression));
    }

    switch (expression.type) {
      case 'ResolvedCallExpression': {
        return this.ResolvedCallExpression(expression, context.upsertOuterExpr(expression), {
          ifArgs: 'call:callee',
          noArgs: syntax,
        });
      }

      case 'PathExpression':
        return this.PathExpression(expression, context.upsertOuterExpr(expression), syntax);

      case 'CallExpression':
        return this.CallExpression(expression, context.upsertOuterExpr(expression));

      default:
        exhausted(expression);
    }
  }

  AttrValueExpression(
    expression: mir.AttrValueExpressionNode | ASTv2.UnresolvedBinding,
    context: StrictMode.OuterContext,
    syntax: ASTv2.PathSyntaxType
  ) {
    switch (expression.type) {
      case 'InterpolateExpression':
        return this.InterpolateExpression(expression, context.replaceOuterExpr(expression));
      default:
        return this.ExpressionValue(expression, context, syntax);
    }
  }

  ExpressionValue(
    expression: mir.ExpressionValueNode | mir.Missing | ASTv2.UnresolvedBinding,
    context: StrictMode.ValidationContext,
    syntax: ASTv2.PathSyntaxType
  ) {
    switch (expression.type) {
      case 'Literal':
        return Ok(null);
      case 'UnresolvedBinding':
        return this.errorFor(expression, context.withPathHead(expression, syntax));
      default:
        return this.CalleeExpression(expression, context, syntax);
    }
  }

  PathExpression(
    expression: mir.PathExpression,
    context: StrictMode.ValidationContext,
    syntax: ASTv2.PathSyntaxType
  ): Result<null> {
    return this.VariableReference(expression.head, context.withPathNode(expression, syntax));
  }

  CustomExpression(
    expression: mir.CustomExpression,
    context: StrictMode.ValidationContext
  ): Result<null> {
    switch (expression.type) {
      case 'GetDynamicVar':
        return this.GetDynamicVar(expression, context.upsertOuterExpr(expression));

      case 'Not':
        return this.Not(expression, context.upsertOuterExpr(expression));

      case 'IfExpression':
        return this.IfExpression(expression, context.upsertOuterExpr(expression));

      case 'Curry':
        return this.Curry(expression, context.upsertOuterExpr(expression));

      case 'Log':
        return this.Log(expression, context.upsertOuterExpr(expression));

      case 'HasBlock':
        return this.HasBlock(expression, context.upsertOuterExpr(expression));

      case 'HasBlockParams':
        return this.HasBlockParams(expression, context.upsertOuterExpr(expression));

      default:
        exhausted(expression);
    }
  }

  GetDynamicVar(expression: mir.GetDynamicVar, options: StrictMode.OuterContext): Result<null> {
    return this.ExpressionValue(
      expression.name,
      options.upsertOuterExpr(expression),
      'value:fixme'
    );
  }

  Not(expression: mir.Not, options: StrictMode.OuterContext): Result<null> {
    return this.ExpressionValue(expression.value, options, 'value:fixme');
  }

  HasBlock(_expression: mir.HasBlock, _options: StrictMode.OuterContext): Result<null> {
    return Ok(null);
  }

  HasBlockParams(_expression: mir.HasBlockParams, _options: StrictMode.OuterContext): Result<null> {
    return Ok(null);
  }

  Args(args: mir.Args, options: StrictMode.OuterContext): Result<null> {
    return this.Positional(args.positional, options.upsertOuterExpr(args.positional)).andThen(() =>
      this.NamedArguments(args.named, options.upsertOuterExpr(args.named))
    );
  }

  Positional(positional: mir.Positional, context: StrictMode.OuterContext): Result<null> {
    let expressions = positional.list.toArray();
    return this.Expressions(expressions, context, 'arg:positional');
  }

  NamedArguments({ entries }: mir.NamedArguments, context: StrictMode.OuterContext): Result<null> {
    let result = Ok(null);

    for (let arg of entries.toArray()) {
      result = result.andThen(() => this.NamedArgument(arg, context));
    }

    return result;
  }

  NamedArgument(arg: mir.NamedArgument, context: StrictMode.OuterContext): Result<null> {
    return this.AttrValueExpression(arg.value, context.replaceOuterExpr(arg), 'arg:named');
  }

  ElementParameters(
    { body }: mir.ElementParameters,
    context: StrictMode.ContentValidationContext
  ): Result<null> {
    let result = Ok(null);

    for (let param of body.toArray()) {
      result = result.andThen(() => this.ElementParameter(param, context));
    }

    return result;
  }

  ElementParameter(
    param: mir.ElementParameter,
    _originalContext: StrictMode.ContentValidationContext
  ): Result<null> {
    switch (param.type) {
      case 'DynamicAttr':
        return this.DynamicAttr(param);
      case 'ResolvedModifier': {
        const context = ContentValidationContext.of(param, 'modifier');
        return this.ResolvedCallee(param.callee, context, 'modifier:callee').andThen(() =>
          this.Args(param.args, context)
        );
      }
      // The callee in lexical and dynamic modifiers is known to not be a potentially resolvable
      // expression, so we can don't need to checking it.
      case 'LexicalModifier':
      case 'DynamicModifier': {
        const context = ContentValidationContext.of(param, 'modifier');
        return this.ExpressionValue(
          param.callee,
          context.replaceOuterExpr(param.callee),
          'modifier:callee'
        ).andThen(() => this.Args(param.args, context));
      }
      // there is no way for any of these constructs to fail, since they contain no expressions
      // that could possibly be resolvable.
      case 'StaticAttr':
      case 'SplatAttr':
        return Ok(null);
    }
  }

  DynamicAttr(attr: mir.DynamicAttr): Result<null> {
    debugger;
    const context = ContentValidationContext.of(attr, 'attr');
    switch (attr.value.type) {
      case 'Literal':
        return this.Literal(attr.value, context.withPathHead(attr.value, 'attr:value'));
      case 'InterpolateExpression':
        return this.InterpolateExpression(attr.value, context.replaceOuterExpr(attr.value));
      case 'CallExpression':
        return this.CallExpression(attr.value, context.replaceOuterExpr(attr));
      case 'PathExpression':
        return this.ExpressionValue(
          attr.value.head,
          context.withPathNode(attr.value, 'value:fixme'),
          'attr:value'
        );
      case 'ResolvedCallExpression':
        return this.ResolvedCallExpression(attr.value, context.replaceOuterExpr(attr.value), {
          ifArgs: 'attr:callee',
          noArgs: 'attr:value',
        });
      case 'Keyword': {
        return this.KeywordExpression(attr.value, context.withPathHead(attr.value, 'attr:value'));
      }
      case 'ResolvedCallee':
        return this.ResolvedCallee(attr.value, context, 'attr:value');
      default:
        if (mir.isVariableReference(attr.value)) {
          return this.VariableReference(attr.value, context.withPathHead(attr.value, 'attr:value'));
        }
        if (mir.isCustomExpr(attr.value)) {
          return this.CustomExpression(attr.value, context.withPathHead(attr.value, 'attr:value'));
        }
        exhausted(attr.value);
    }
  }

  KeywordExpression(
    _expr: ASTv2.KeywordExpression,
    _context: StrictMode.ValidationContext
  ): Result<null> {
    return Ok(null);
  }

  ResolvedCallExpression(
    expr: mir.ResolvedCallExpression,
    context: StrictMode.OuterContext,
    syntax: { ifArgs: ASTv2.PathSyntaxType; noArgs: ASTv2.PathSyntaxType }
  ): Result<null> {
    return this.ResolvedCallee(
      expr.callee,
      context,
      expr.args.isEmpty() ? syntax.noArgs : syntax.ifArgs
    ).andThen(() => this.Args(expr.args, context));
  }

  Literal(_literal: ASTv2.LiteralExpression, _context: StrictMode.ValidationContext): Result<null> {
    return Ok(null);
  }

  VariableReference(
    ref: ASTv2.VariableReference | ASTv2.UnresolvedBinding,
    context: StrictMode.PathValidationContext
  ): Result<null> {
    if (ref.type === 'UnresolvedBinding') {
      return this.errorFor(ref, context);
    }
    return Ok(null);
  }

  AppendResolvedInvokable(
    statement: mir.AppendResolvedInvokableCautiously | mir.AppendTrustingResolvedInvokable
  ): Result<null> {
    const context = ContentValidationContext.of(statement, 'content');
    return this.ResolvedCallee(statement.callee, context, getAppendType(statement)).andThen(() =>
      this.Args(statement.args, context.withOuter(statement.args))
    );
  }

  InElement(inElement: mir.InElement): Result<null> {
    const context = ContentValidationContext.of(inElement, { custom: 'in-element' });

    return this.ExpressionValue(
      inElement.destination,
      context.withOuter(inElement.destination),
      'arg:positional'
    )
      .andThen(() =>
        this.ExpressionValue(
          inElement.insertBefore,
          context.withOuter(inElement.insertBefore),
          'arg:named'
        )
      )
      .andThen(() => this.NamedBlock(inElement.block));
  }

  Yield(statement: mir.Yield): Result<null> {
    return this.Positional(
      statement.positional,
      ContentValidationContext.of(statement, { custom: 'yield' })
    );
  }

  AppendTrustedHTML(statement: mir.AppendTrustedHTML): Result<null> {
    return this.ExpressionValue(
      statement.html,
      ContentValidationContext.of(statement, 'content'),
      'append:value'
    );
  }

  AppendValueCautiously(statement: mir.AppendValueCautiously): Result<null> {
    if (statement.value.type === 'CallExpression') {
      return this.CalleeExpression(
        statement.value,
        ContentValidationContext.of(statement, 'content'),
        getAppendType(statement.value)
      );
    } else {
      return this.ExpressionValue(
        statement.value,
        ContentValidationContext.of(statement, 'content'),
        getAppendType(statement.value)
      );
    }
  }

  AngleBracketComponent(
    statement: mir.AngleBracketComponent | mir.ResolvedAngleBracketComponent
  ): Result<null> {
    const context = ContentValidationContext.of(statement, 'component');
    debugger;
    return this.CalleeExpression(
      statement.tag,
      context
        .withPathNode(getCallee(statement.tag), 'component:callee')
        .addNotes('TODO: implement strict mode'),
      'component:callee'
    )
      .andThen(() => this.ElementParameters(statement.params, context))
      .andThen(() => this.NamedArguments(statement.args, context))
      .andThen(() => this.NamedBlocks(statement.blocks));
  }

  SimpleElement(statement: mir.SimpleElement): Result<null> {
    const context = ContentValidationContext.of(statement, 'element');
    return this.ElementParameters(statement.params, context).andThen(() =>
      this.ContentItems(statement.body)
    );
  }

  InvokeBlock(
    statement: mir.InvokeBlockComponent | mir.InvokeResolvedBlockComponent
  ): Result<null> {
    const context = ContentValidationContext.of(statement, 'block');

    return this.CalleeExpression(statement.head, context, 'block:callee')
      .andThen(() => this.Args(statement.args, context))
      .andThen(() => this.NamedBlocks(statement.blocks));
  }

  IfContent(statement: mir.IfContent): Result<null> {
    const context = ContentValidationContext.of(statement, { custom: 'if' });

    return this.ExpressionValue(statement.condition, context, 'arg:positional')
      .andThen(() => this.NamedBlock(statement.block))
      .andThen(() => {
        if (statement.inverse) {
          return this.NamedBlock(statement.inverse);
        } else {
          return Ok(null);
        }
      });
  }

  Each(statement: mir.Each): Result<null> {
    const context = ContentValidationContext.of(statement, { custom: 'each' });

    return this.ExpressionValue(statement.value, context, 'arg:positional')
      .andThen(() => {
        if (statement.key) {
          return this.ExpressionValue(statement.key, context, 'arg:positional');
        } else {
          return Ok(null);
        }
      })
      .andThen(() => this.NamedBlock(statement.block))
      .andThen(() => {
        if (statement.inverse) {
          return this.NamedBlock(statement.inverse);
        } else {
          return Ok(null);
        }
      });
  }

  Let(statement: mir.Let): Result<null> {
    const context = ContentValidationContext.of(statement, { custom: 'let' });

    return this.Positional(statement.positional, context).andThen(() =>
      this.NamedBlock(statement.block)
    );
  }

  WithDynamicVars(statement: mir.WithDynamicVars): Result<null> {
    const context = ContentValidationContext.of(statement, { custom: 'with' });

    return this.NamedArguments(statement.named, context).andThen(() =>
      this.NamedBlock(statement.block)
    );
  }

  InvokeComponentKeyword(statement: mir.InvokeComponentKeyword): Result<null> {
    const context = ContentValidationContext.of(statement, { custom: 'component' });

    return this.ExpressionValue(statement.definition, context, 'value:fixme').andThen(() =>
      this.Args(statement.args, context)
    );
  }

  InvokeResolvedComponentKeyword(statement: mir.InvokeResolvedComponentKeyword): Result<null> {
    return this.Args(
      statement.args,
      ContentValidationContext.of(statement, { custom: 'component' })
    ).andThen(() => {
      if (statement.blocks) this.NamedBlocks(statement.blocks);
      return Ok(null);
    });
  }

  InterpolateExpression(
    expression: mir.InterpolateExpression,
    context: StrictMode.OuterExpressionValidationContext
  ): Result<null> {
    let expressions = expression.parts.toArray();
    return this.Expressions(expressions, context.replaceOuterExpr(expression), 'interpolate:value');
  }

  CallExpression(expression: mir.CallExpression, context: StrictMode.OuterContext): Result<null> {
    return this.ExpressionValue(
      expression.callee,
      context.replaceOuterExpr(expression.callee),
      'call:callee'
    ).andThen(() => this.Args(expression.args, context));
  }

  IfExpression(expression: mir.IfExpression, options: StrictMode.OuterContext): Result<null> {
    return this.ExpressionValue(
      expression.condition,
      options.replaceOuterExpr(expression.condition),
      'arg:positional'
    )
      .andThen(() =>
        this.ExpressionValue(
          expression.truthy,
          options.replaceOuterExpr(expression.truthy),
          'arg:positional'
        )
      )
      .andThen(() => {
        if (expression.falsy) {
          return this.ExpressionValue(
            expression.falsy,
            options.replaceOuterExpr(expression.falsy),
            'arg:positional'
          );
        } else {
          return Ok(null);
        }
      });
  }

  Curry(expression: mir.Curry, context: StrictMode.OuterContext): Result<null> {
    return this.ExpressionValue(
      expression.definition,
      context.replaceOuterExpr(expression.definition),
      'arg:positional'
    ).andThen(() => this.Args(expression.args, context));
  }

  Log(expression: mir.Log, context: StrictMode.OuterContext): Result<null> {
    return this.Positional(expression.positional, context.replaceOuterExpr(expression.positional));
  }

  ResolvedCallee(
    callee: ASTv2.ResolvedCallee,
    context: StrictMode.OuterContext,
    syntax: ASTv2.PathSyntaxType
  ): Result<null> {
    if (this.#strict) {
      return this.errorFor(callee, context.withPathHead(callee, syntax));
    } else {
      return Ok(null);
    }
  }

  errorFor(
    callee: ASTv2.ResolvedCallee | ASTv2.UnresolvedBinding,
    context: StrictMode.PathValidationContext,
    notes?: string[] | undefined
  ): Result<null> {
    if (this.template.scope.hasKeyword(callee.name)) {
      return Ok(null);
    }

    return Err(
      unresolvedBindingError({
        context,
        notes,
      })
    );
  }
}

function getCallee(
  path: mir.BlockCallee | ASTv2.ResolvedCallee
): HasSourceSpan & { head: HasSourceSpan } {
  switch (path.type) {
    case 'PathExpression':
      return path;
    case 'ResolvedCallee':
    case 'Keyword':
    case 'This':
    case 'Arg':
    case 'Local':
    case 'Lexical':
      return { loc: path.loc, head: path };
  }
}

function getAppendType(
  expr:
    | mir.ExpressionValueNode
    | ASTv2.UnresolvedBinding
    | mir.AppendResolvedInvokableCautiously
    | mir.AppendTrustingResolvedInvokable
): ASTv2.PathSyntaxType {
  switch (expr.type) {
    case 'ResolvedCallExpression':
    case 'CallExpression':
    case 'AppendResolvedInvokableCautiously':
    case 'AppendTrustingResolvedInvokable':
      return expr.args.isEmpty() ? 'append:value' : 'append:callee';
    default:
      return 'append:value';
  }
}
