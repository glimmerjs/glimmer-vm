import { ExpressionContext } from '@glimmer/interfaces';
import { AST, builders } from '@glimmer/syntax';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../pass1/ops';
import { Result } from '../../../shared/result';
import { SymbolTable } from '../../../shared/symbol-table';
import { Context } from '../../context';
import { ClassifiedElement } from './classified';
import { ClassifiedComponent } from './component';
import { ClassifiedSimpleElement } from './simple-element';

export function toStatement(ctx: Context, element: AST.ElementNode): Result<pass1.Statement> {
  return classify(ctx, element).toStatement();
}

function classify(ctx: Context, element: AST.ElementNode): ClassifiedElement<unknown> {
  // this code is parsing the expression at the head of component, which
  // is not done by @glimmer/syntax, and notably is scope-sensitive.

  let { tag, loc, attributes, modifiers } = element;

  let [maybeLocal, ...rest] = tag.split('.');

  let kind = classifyTag(maybeLocal, ctx.symbols.current);

  switch (kind) {
    case 'Element':
      return new ClassifiedElement(
        element,
        new ClassifiedSimpleElement(
          ctx.slice(tag).loc(loc),
          hasDynamicFeatures({ attributes, modifiers })
        ),
        ctx
      );

    case 'Uppercase':
      return new ClassifiedElement(
        element,
        new ClassifiedComponent(
          ctx
            .op(pass1.GetVar, {
              name: ctx.slice(ctx.customizeComponentName(tag)).offsets(null),
              context: ExpressionContext.ComponentHead,
            })
            .loc(loc)
        ),
        ctx
      );

    case 'Variable':
      return new ClassifiedElement(
        element,
        new ClassifiedComponent(
          ctx.visitExpr(
            builders.fullPath(builders.head(maybeLocal), rest),
            ExpressionContext.ComponentHead
          )
        ),
        ctx
      );
  }
}

type ElementKind = 'Variable' | 'Uppercase' | 'Element';

function classifyTag(variable: string, currentSymbols: SymbolTable): ElementKind {
  if (variable[0] === '@' || variable === 'this' || currentSymbols.has(variable)) {
    return 'Variable';
  } else if (isUpperCase(variable)) {
    return 'Uppercase';
  } else {
    return 'Element';
  }
}

export function isUpperCase(tag: string): boolean {
  return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
}

export function hasDynamicFeatures({
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
