import type { ASTv2 } from '@glimmer/syntax';
import { exhausted } from '@glimmer/debug-util';
import { GlimmerSyntaxError, Validation as Validation } from '@glimmer/syntax';

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
      result = result.andThen(() => {
        if (block.type === 'Error') {
          return Err(GlimmerSyntaxError.forErrorNode(block));
        }
        return this.NamedBlock(block);
      });
    }

    return result;
  }

  NamedBlock(block: mir.NamedBlock): Result<null> {
    if (block.error) {
      return Err(GlimmerSyntaxError.forErrorNode(block.error));
    }
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

      case 'AppendInvokableCautiously':
      case 'AppendTrustingInvokable':
        return this.AppendInvokable(statement);

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
    context: Validation.PositionalArgsContext
  ): Result<null> {
    let result = Ok(null);

    for (let expression of expressions) {
      result = result.andThen(() => this.ExpressionValue(expression, context.value(expression)));
    }

    return result;
  }

  CalleeExpression(
    expression: mir.CalleeExpression,
    context: Validation.ValueValidationContext
  ): Result<null> {
    if (mir.isVariableReference(expression)) {
      return this.VariableReference(expression);
    }

    if (mir.isCustomExpr(expression)) {
      return this.CustomExpression(expression, context);
    }

    switch (expression.type) {
      case 'Keyword':
        return this.KeywordExpression(expression);

      case 'ResolvedCallExpression': {
        return this.ResolvedCallExpression(expression, context.subexpression(expression));
      }

      case 'PathExpression':
        return this.PathExpression(expression, context.path());

      case 'CallExpression':
        return this.CallExpression(expression, context.subexpression(expression));

      default:
        exhausted(expression);
    }
  }

  AttrStyleArgument(
    expression: { value: mir.AttrStyleValue },
    context: Validation.FullElementParameterValidationContext
  ) {
    const value = expression.value;
    switch (value.type) {
      case 'InterpolateExpression':
        return this.InterpolateExpression(value, context.concat(value));
      default:
        return this.AttrStyleValue(value, context);
    }
  }

  CoreAttrStyleValue(
    part: mir.CoreAttrStyleInterpolatePart,
    value: Validation.AnyAttrLikeContainerContext
  ) {
    switch (part.type) {
      case 'Literal':
        return this.Literal(part);
      case 'CurlyResolvedAttrValue':
        return this.ResolvedName(part.resolved, value.value({ value: part.resolved, curly: part }));
      case 'mir.CurlyAttrValue':
        return this.ExpressionValue(part.value, value.value({ curly: part, value: part.value }));
      case 'mir.CurlyInvokeAttr': {
        const invokeContext = value.invoke(part);

        if (part.callee.type === 'UnresolvedBinding') {
          return this.errorFor(invokeContext.resolved(part.callee)).andThen(() =>
            this.Args(part.args, invokeContext.args(part.args))
          );
        }

        return this.CalleeExpressionValue(part.callee, invokeContext).andThen(() =>
          this.Args(part.args, invokeContext.args(part.args))
        );
      }
      case 'mir.CurlyInvokeResolvedAttr': {
        const invokeContext = value.invoke(part);
        return this.ResolvedName(part.resolved, invokeContext).andThen(() =>
          this.Args(part.args, invokeContext.args(part.args))
        );
      }
    }
  }

  AttrStyleValue(
    part: mir.AttrStyleInterpolatePart,
    value: Validation.AnyAttrLikeContainerContext
  ) {
    switch (part.type) {
      case 'mir.CustomInterpolationPart':
        return this.CustomExpression(part.value, value.value({ curly: part, value: part.value }));
      default:
        return this.CoreAttrStyleValue(part, value);
    }
  }

  CustomNamedArgument(
    expression: mir.CustomNamedArgument<mir.ExpressionValueNode> | mir.Missing,
    context: Validation.InvokeCustomSyntaxContext
  ) {
    switch (expression.type) {
      case 'Missing':
        return Ok(null);
      case 'CustomNamedArgument':
        return this.ExpressionValue(expression.value, context.namedArg(expression));
    }
  }

  CalleeExpressionValue(
    expression: mir.ExpressionValueNode | mir.Missing | ASTv2.UnresolvedBinding,
    context: Validation.AnyInvokeParentContext
  ) {
    switch (expression.type) {
      case 'Literal':
        return Ok(null);
      case 'UnresolvedBinding':
        return this.errorFor(context.resolved(expression));
      case 'Missing':
        return Ok(null);
      case 'PathExpression':
        return this.PathExpression(expression, context.callee(expression).path());
      default:
        return this.CalleeExpression(expression, context.callee(expression));
    }
  }

  ExpressionValue(
    expression: mir.ExpressionValueNode | mir.Missing | ASTv2.UnresolvedBinding,
    context: Validation.ValueValidationContext
  ) {
    switch (expression.type) {
      case 'Literal':
        return Ok(null);
      case 'UnresolvedBinding':
        return this.errorFor(context.resolved(expression));
      case 'Missing':
        return Ok(null);
      case 'PathExpression':
        return this.PathExpression(expression, context.path());
      default:
        return this.CalleeExpression(expression, context);
    }
  }

  PathOrVariableReference(
    expression: mir.PathExpression | ASTv2.VariableReference,
    context: Validation.PathValidationContext
  ): Result<null> {
    if (expression.type === 'PathExpression') {
      return this.PathExpression(expression, context);
    } else {
      return this.VariableReference(expression);
    }
  }

  PathExpression(
    expression: mir.PathExpression,
    context: Validation.PathValidationContext
  ): Result<null> {
    if (expression.head.type === 'UnresolvedBinding') {
      return this.errorFor(context.head(expression.head));
    } else {
      return this.VariableReference(expression.head);
    }
  }

  CustomExpression(
    expression: mir.CustomExpression,
    valueContext: Validation.ValueValidationContext
  ): Result<null> {
    const context = valueContext.custom(expression);
    switch (expression.type) {
      case 'GetDynamicVar':
        return this.GetDynamicVar(expression, context);

      case 'Not':
        return this.Not(expression, context);

      case 'IfExpression':
        return this.IfExpression(expression, context);

      case 'Curry':
        return this.Curry(expression, context);

      case 'Log':
        return this.Log(expression, context);

      case 'HasBlock':
        return this.HasBlock(expression);

      case 'HasBlockParams':
        return this.HasBlockParams(expression);

      default:
        exhausted(expression);
    }
  }

  GetDynamicVar(
    expression: mir.GetDynamicVar,
    context: Validation.InvokeCustomSyntaxContext
  ): Result<null> {
    return this.ExpressionValue(expression.name, context.positional('name', expression));
  }

  Not(expression: mir.Not, context: Validation.InvokeCustomSyntaxContext): Result<null> {
    return this.ExpressionValue(expression.value, context.positional('value', expression.value));
  }

  HasBlock(_expression: mir.HasBlock): Result<null> {
    return Ok(null);
  }

  HasBlockParams(_expression: mir.HasBlockParams): Result<null> {
    return Ok(null);
  }

  Args(args: mir.Args, context: Validation.ArgsContainerContext): Result<null> {
    return this.Positional(args.positional, context.positionalArgs(args.positional)).andThen(() =>
      this.NamedArguments(args.named, context)
    );
  }

  Positional(positional: mir.Positional, context: Validation.PositionalArgsContext): Result<null> {
    let expressions = positional.list.toArray();
    return this.Expressions(expressions, context);
  }

  ComponentArguments(
    { entries }: mir.ComponentArguments,
    context: Validation.AngleBracketContext
  ): Result<null> {
    let result = Ok(null);

    for (let arg of entries.toArray()) {
      result = result.andThen(() => this.AttrStyleArgument(arg, context.arg(arg)));
    }

    return result;
  }

  NamedArguments(
    { entries }: mir.CurlyNamedArguments,
    context: Validation.ArgsContainerContext
  ): Result<null> {
    let result = Ok(null);

    for (let arg of entries.toArray()) {
      result = result.andThen(() => this.NamedArgument(arg, context));
    }

    return result;
  }

  NamedArgument(
    arg: mir.CurlyNamedArgument,
    context: Validation.ArgsContainerContext
  ): Result<null> {
    return this.ExpressionValue(arg.value, context.namedArg(arg));
  }

  ElementParameters(
    { body }: mir.ElementParameters,
    context: Validation.AngleBracketContext
  ): Result<null> {
    let result = Ok(null);

    for (let param of body.toArray()) {
      result = result.andThen(() => this.ElementParameter(param, context));
    }

    return result;
  }

  ElementParameter(
    param: mir.ElementParameter,
    content: Validation.AngleBracketContext
  ): Result<null> {
    switch (param.type) {
      case 'DynamicAttr':
        return this.AttrStyleArgument(param, content.attr(param));
      case 'ResolvedModifier': {
        const context = content.modifier(param);
        return this.ResolvedName(param.callee, context).andThen(() =>
          this.Args(param.args, context.args(param.args))
        );
      }
      // The callee in lexical and dynamic modifiers is known to not be a potentially resolvable
      // expression, so we can don't need to checking it.
      case 'LexicalModifier':
      case 'DynamicModifier': {
        const context = content.modifier(param);
        return this.ExpressionValue(param.callee, context.callee(param.callee)).andThen(() =>
          this.Args(param.args, context.args(param.args))
        );
      }
      // there is no way for any of these constructs to fail, since they contain no expressions
      // that could possibly be resolvable.
      case 'StaticAttr':
      case 'SplatAttr':
        return Ok(null);
    }
  }

  KeywordExpression(_expr: ASTv2.KeywordExpression): Result<null> {
    return Ok(null);
  }

  ResolvedCallExpression(
    expr: mir.ResolvedCallExpression,
    context: Validation.AnyInvokeParentContext
  ): Result<null> {
    const name = this.ResolvedName(expr.callee, context);

    if (expr.args.isEmpty()) {
      return name;
    } else {
      return name.andThen(() => this.Args(expr.args, context.args(expr.args)));
    }
  }

  Literal(_literal: ASTv2.LiteralExpression): Result<null> {
    return Ok(null);
  }

  MaybeResolvedVariableReference(
    ref: ASTv2.VariableReference | ASTv2.UnresolvedBinding,
    context: Validation.PathValidationContext
  ): Result<null> {
    if (ref.type === 'UnresolvedBinding') {
      return this.errorFor(context.head(ref));
    }
    return Ok(null);
  }

  VariableReference(_ref: ASTv2.VariableReference): Result<null> {
    return Ok(null);
  }

  AppendInvokable(
    statement: mir.AppendInvokableCautiously | mir.AppendTrustingInvokable
  ): Result<null> {
    const context = Validation.appending(statement).invoke();
    const callee = statement.callee;

    const args = this.Args(statement.args, context.args(statement.args));

    if (Validation.isResolvedName(callee)) {
      return this.ResolvedName(callee, context).andThen(() => args);
    } else {
      return this.ExpressionValue(callee, context.callee(callee)).andThen(() => args);
    }
  }

  InElement(inElement: mir.InElement): Result<null> {
    const context = Validation.custom(inElement);

    return this.ExpressionValue(
      inElement.destination,
      context.positional('destination', inElement.destination)
    )
      .andThen(() => this.CustomNamedArgument(inElement.insertBefore, context))
      .andThen(() => this.NamedBlock(inElement.block));
  }

  Yield(statement: mir.Yield): Result<null> {
    return this.Positional(
      statement.positional,
      Validation.InvokeCustomSyntaxContext.keyword(statement).positionalArgs(statement.positional)
    );
  }

  AppendTrustedHTML(statement: mir.AppendTrustedHTML): Result<null> {
    const context = Validation.appending(statement);
    const value = statement.value;

    if (Validation.isResolvedName(value)) {
      return this.ResolvedName(value, context);
    } else {
      return this.ExpressionValue(value, context.append(value));
    }
  }

  AppendValueCautiously(statement: mir.AppendValueCautiously): Result<null> {
    const context = Validation.appending(statement);
    const value = statement.value;

    if (Validation.isResolvedName(value)) {
      return this.ResolvedName(value, context);
    } else {
      return this.ExpressionValue(value, context.append(value));
    }
  }

  AngleBracketComponent(
    statement: mir.AngleBracketComponent | mir.ResolvedAngleBracketComponent
  ): Result<null> {
    const context = Validation.component(statement);

    return this.ComponentTag(statement.tag, context)
      .andThen(() => this.ElementParameters(statement.params, context))
      .andThen(() => this.ComponentArguments(statement.args, context))
      .andThen(() => this.NamedBlocks(statement.blocks));
  }

  ComponentTag(
    tag: mir.BlockCallee | ASTv2.ResolvedName,
    context: Validation.AngleBracketContext
  ): Result<null> {
    switch (tag.type) {
      case 'ResolvedName':
        if (this.#strict) {
          return this.errorFor(
            context
              .tag(tag)
              .path()
              .head(tag)
              .addNote(
                `If you wanted to create an element with that name, convert it to lowercase - \`<${tag.name.toLowerCase()}>\``
              )
          );
        } else {
          return Ok(null);
        }
      case 'Keyword':
        return this.errorFor(context.tag(tag).path().head(tag));
      default:
        return this.PathOrVariableReference(tag, context.tag(tag).path());
    }
  }

  SimpleElement(statement: mir.SimpleElement): Result<null> {
    const context = Validation.element(statement);
    return this.ElementParameters(statement.params, context).andThen(() =>
      this.ContentItems(statement.body)
    );
  }

  InvokeBlock(
    statement: mir.InvokeBlockComponent | mir.InvokeResolvedBlockComponent
  ): Result<null> {
    const context = Validation.block(statement);

    const callee =
      statement.type === 'InvokeResolvedBlockComponent'
        ? this.ResolvedName(statement.head, context)
        : this.CalleeExpression(statement.head, context.callee(statement.head));

    return callee
      .andThen(() => this.Args(statement.args, context.args(statement.args)))
      .andThen(() => this.NamedBlocks(statement.blocks));
  }

  IfContent(statement: mir.IfContent): Result<null> {
    const context = Validation.InvokeCustomSyntaxContext.keyword(statement);

    return this.ExpressionValue(
      statement.condition,
      context.positional('condition', statement.condition)
    )
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
    const context = Validation.InvokeCustomSyntaxContext.keyword(statement);

    return this.ExpressionValue(statement.value, context.positional('value', statement.value))
      .andThen(() => {
        if (statement.key) {
          return this.ExpressionValue(statement.key.value, context.namedArg(statement.key));
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
    const context = Validation.InvokeCustomSyntaxContext.keyword(statement);

    return this.Positional(
      statement.positional,
      context.positionalArgs(statement.positional)
    ).andThen(() => this.NamedBlock(statement.block));
  }

  WithDynamicVars(statement: mir.WithDynamicVars): Result<null> {
    const context = Validation.InvokeCustomSyntaxContext.keyword(statement);

    return this.NamedArguments(statement.named, context).andThen(() =>
      this.NamedBlock(statement.block)
    );
  }

  InvokeComponentKeyword(statement: mir.InvokeComponentKeyword): Result<null> {
    const context = Validation.InvokeCustomSyntaxContext.keyword(statement);

    return this.ExpressionValue(
      statement.definition,
      context.positional('definition', statement.definition)
    ).andThen(() => this.Args(statement.args, context));
  }

  InvokeResolvedComponentKeyword(statement: mir.InvokeResolvedComponentKeyword): Result<null> {
    const context = Validation.InvokeCustomSyntaxContext.keyword(statement);

    return this.Args(statement.args, context).andThen(() => {
      if (statement.blocks) this.NamedBlocks(statement.blocks);
      return Ok(null);
    });
  }

  InterpolateExpression(
    expression: mir.InterpolateExpression,
    context: Validation.ConcatContext
  ): Result<null> {
    let expressions = expression.parts.toArray();
    let result = Ok(null);

    for (let expression of expressions) {
      result = result.andThen(() => this.AttrStyleValue(expression, context));
    }

    return result;
  }

  CallExpression(
    expression: mir.CallExpression,
    context: Validation.SubExpressionContext
  ): Result<null> {
    return this.ExpressionValue(expression.callee, context.callee(expression.callee)).andThen(() =>
      this.Args(expression.args, context.args(expression.args))
    );
  }

  IfExpression(
    expression: mir.IfExpression,
    context: Validation.InvokeCustomSyntaxContext
  ): Result<null> {
    return this.ExpressionValue(
      expression.condition,
      context.positional('condition', expression.condition)
    )
      .andThen(() =>
        this.ExpressionValue(expression.truthy, context.positional('truthy', expression.truthy))
      )
      .andThen(() => {
        if (expression.falsy) {
          return this.ExpressionValue(
            expression.falsy,
            context.positional('falsy', expression.falsy)
          );
        } else {
          return Ok(null);
        }
      });
  }

  Curry(expression: mir.Curry, context: Validation.InvokeCustomSyntaxContext): Result<null> {
    return this.ExpressionValue(
      expression.definition,
      context.positional('definition', expression.definition)
    ).andThen(() => this.Args(expression.args, context));
  }

  Log(expression: mir.Log, context: Validation.InvokeCustomSyntaxContext): Result<null> {
    return this.Positional(expression.positional, context.positionalArgs(expression.positional));
  }

  ResolvedName(
    callee: ASTv2.ResolvedName | ASTv2.UnresolvedBinding,
    context: Validation.AnyResolveParentContext
  ): Result<null> {
    if (callee.type === 'UnresolvedBinding') {
      return this.errorFor(context.resolved(callee).addNotes(callee.notes ?? []));
    } else if (this.#strict) {
      return this.errorFor(context.resolved(callee));
    } else {
      return Ok(null);
    }
  }

  errorFor(context: Validation.VariableReferenceContext): Result<null> {
    if (this.template.scope.hasKeyword(context.name)) {
      return Ok(null);
    }

    return Err(context.error());
  }
}
