import type {
  CompileTimeComponent,
  StatementSexpOpcode,
  WellKnownAttrName,
  WellKnownTagName,
} from '@glimmer/interfaces';
import { $fp, Op } from '@glimmer/vm';
import { SexpOpcodes } from '@glimmer/wire-format';

import type { Compilers, PushStatementOp } from './compilers';

import { InvokeComponent, InvokeDynamicComponent } from '../opcode-builder/helpers/components';
import { expr } from '../opcode-builder/helpers/expr';
import { isGetFreeComponent, isGetFreeModifier } from '../opcode-builder/helpers/resolution';
import { SimpleArgs } from '../opcode-builder/helpers/shared';
import { HighLevelResolutionOpcodes } from '../opcode-builder/opcodes';

const INFLATE_ATTR_TABLE: {
  [I in WellKnownAttrName]: string;
} = ['class', 'id', 'value', 'name', 'type', 'style', 'href'];
const INFLATE_TAG_TABLE: {
  [I in WellKnownTagName]: string;
} = ['div', 'span', 'p', 'a'];

export function inflateTagName(tagName: string | WellKnownTagName): string {
  return typeof tagName === 'string' ? tagName : INFLATE_TAG_TABLE[tagName];
}

export function inflateAttrName(attrName: string | WellKnownAttrName): string {
  return typeof attrName === 'string' ? attrName : INFLATE_ATTR_TABLE[attrName];
}

export function defineDOM(statements: Compilers<PushStatementOp, StatementSexpOpcode>) {
  statements.add(SexpOpcodes.Comment, (op, sexp) => op(Op.Comment, sexp[1]));
  statements.add(SexpOpcodes.CloseElement, (op) => op(Op.CloseElement));
  statements.add(SexpOpcodes.FlushElement, (op) => op(Op.FlushElement));

  statements.add(SexpOpcodes.Modifier, (op, [, expression, positional, named]) => {
    if (isGetFreeModifier(expression)) {
      op(HighLevelResolutionOpcodes.Modifier, expression, (handle: number) => {
        op(Op.PushFrame);
        SimpleArgs(op, positional, named, false);
        op(Op.Modifier, handle);
        op(Op.PopFrame);
      });
    } else {
      expr(op, expression);
      op(Op.PushFrame);
      SimpleArgs(op, positional, named, false);
      op(Op.Dup, $fp, 1);
      op(Op.DynamicModifier);
      op(Op.PopFrame);
    }
  });

  statements.add(SexpOpcodes.StaticAttr, (op, [, name, value, namespace]) => {
    op(Op.StaticAttr, inflateAttrName(name), value as string, namespace ?? null);
  });

  statements.add(SexpOpcodes.StaticComponentAttr, (op, [, name, value, namespace]) => {
    op(Op.StaticComponentAttr, inflateAttrName(name), value as string, namespace ?? null);
  });

  statements.add(SexpOpcodes.DynamicAttr, (op, [, name, value, namespace]) => {
    expr(op, value);
    op(Op.DynamicAttr, inflateAttrName(name), false, namespace ?? null);
  });

  statements.add(SexpOpcodes.TrustingDynamicAttr, (op, [, name, value, namespace]) => {
    expr(op, value);
    op(Op.DynamicAttr, inflateAttrName(name), true, namespace ?? null);
  });

  statements.add(SexpOpcodes.ComponentAttr, (op, [, name, value, namespace]) => {
    expr(op, value);
    op(Op.ComponentAttr, inflateAttrName(name), false, namespace ?? null);
  });

  statements.add(SexpOpcodes.TrustingComponentAttr, (op, [, name, value, namespace]) => {
    expr(op, value);
    op(Op.ComponentAttr, inflateAttrName(name), true, namespace ?? null);
  });

  statements.add(SexpOpcodes.OpenElement, (op, [, tag]) => {
    op(Op.OpenElement, inflateTagName(tag));
  });

  statements.add(SexpOpcodes.OpenElementWithSplat, (op, [, tag]) => {
    op(Op.PutComponentOperations);
    op(Op.OpenElement, inflateTagName(tag));
  });

  statements.add(SexpOpcodes.Component, (op, [, expr, elementBlock, named, blocks]) => {
    if (isGetFreeComponent(expr)) {
      op(HighLevelResolutionOpcodes.Component, expr, (component: CompileTimeComponent) => {
        InvokeComponent(op, component, elementBlock, null, named, blocks);
      });
    } else {
      // otherwise, the component name was an expression, so resolve the expression
      // and invoke it as a dynamic component
      InvokeDynamicComponent(op, expr, elementBlock, null, named, blocks, true, true);
    }
  });
}
