import type { CompileTimeComponent, WireFormat } from '@glimmer/interfaces';
import { $fp, $sp, COMPONENT_CONTENT, HELPER_CONTENT, Op } from '@glimmer/vm';
import { SexpOpcodes } from '@glimmer/wire-format';

import type { DefineStatement } from './statements';

import {
  InvokeStaticBlock,
  InvokeStaticBlockWithStack,
  YieldBlock,
} from '../opcode-builder/helpers/blocks';
import {
  InvokeComponent,
  InvokeDynamicComponent,
  InvokeNonStaticComponent,
} from '../opcode-builder/helpers/components';
import { Replayable, ReplayableIf, SwitchCases } from '../opcode-builder/helpers/conditional';
import { expr } from '../opcode-builder/helpers/expr';
import {
  isGetFreeComponent,
  isGetFreeComponentOrHelper,
  isGetFreeOptionalComponentOrHelper,
} from '../opcode-builder/helpers/resolution';
import { CompilePositional } from '../opcode-builder/helpers/shared';
import {
  Call,
  CallDynamic,
  DynamicScope,
  PushPrimitiveReference,
} from '../opcode-builder/helpers/vm';
import { HighLevelBuilderOpcodes, HighLevelResolutionOpcodes } from '../opcode-builder/opcodes';
import { debugSymbolsOperand, labelOperand, stdlibOperand } from '../opcode-builder/operands';
import { namedBlocks } from '../utils';

export function defineContent(statements: DefineStatement) {
  statements.add(SexpOpcodes.Yield, (op, [, to, params]) => YieldBlock(op, to, params));

  statements.add(SexpOpcodes.AttrSplat, (op, [, to]) => YieldBlock(op, to, null));

  statements.add(SexpOpcodes.Debugger, (op, [, debugInfo]) =>
    op(Op.Debugger, debugSymbolsOperand(), debugInfo)
  );

  statements.add(SexpOpcodes.Append, (op, [, value]) => {
    // Special case for static values
    if (!Array.isArray(value)) {
      op(Op.Text, value === null || value === undefined ? '' : String(value));
    } else if (isGetFreeOptionalComponentOrHelper(value)) {
      op(HighLevelResolutionOpcodes.OptionalComponentOrHelper, value, {
        ifComponent(component: CompileTimeComponent) {
          InvokeComponent(op, component, null, null, null, null);
        },

        ifHelper(handle: number) {
          op(Op.PushFrame);
          Call(op, handle, null, null);
          op(Op.InvokeStatic, stdlibOperand('cautious-non-dynamic-append'));
          op(Op.PopFrame);
        },

        ifValue(handle: number) {
          op(Op.PushFrame);
          op(Op.ConstantReference, handle);
          op(Op.InvokeStatic, stdlibOperand('cautious-non-dynamic-append'));
          op(Op.PopFrame);
        },
      });
    } else if (value[0] === SexpOpcodes.Call) {
      let [, expression, positional, named] = value;

      if (isGetFreeComponentOrHelper(expression)) {
        op(HighLevelResolutionOpcodes.ComponentOrHelper, expression, {
          ifComponent(component: CompileTimeComponent) {
            InvokeComponent(op, component, null, positional, hashToArgs(named), null);
          },
          ifHelper(handle: number) {
            op(Op.PushFrame);
            Call(op, handle, positional, named);
            op(Op.InvokeStatic, stdlibOperand('cautious-non-dynamic-append'));
            op(Op.PopFrame);
          },
        });
      } else {
        SwitchCases(
          op,
          () => {
            expr(op, expression);
            op(Op.DynamicContentType);
          },
          (when) => {
            when(COMPONENT_CONTENT, () => {
              op(Op.ResolveCurriedComponent);
              op(Op.PushDynamicComponentInstance);
              InvokeNonStaticComponent(op, {
                capabilities: true,
                elementBlock: null,
                positional,
                named,
                atNames: false,
                blocks: namedBlocks(null),
              });
            });

            when(HELPER_CONTENT, () => {
              CallDynamic(op, positional, named, () => {
                op(Op.InvokeStatic, stdlibOperand('cautious-non-dynamic-append'));
              });
            });
          }
        );
      }
    } else {
      op(Op.PushFrame);
      expr(op, value);
      op(Op.InvokeStatic, stdlibOperand('cautious-append'));
      op(Op.PopFrame);
    }
  });

  statements.add(SexpOpcodes.TrustingAppend, (op, [, value]) => {
    if (!Array.isArray(value)) {
      op(Op.Text, value === null || value === undefined ? '' : String(value));
    } else {
      op(Op.PushFrame);
      expr(op, value);
      op(Op.InvokeStatic, stdlibOperand('trusting-append'));
      op(Op.PopFrame);
    }
  });

  statements.add(SexpOpcodes.Block, (op, [, expr, positional, named, blocks]) => {
    if (isGetFreeComponent(expr)) {
      op(HighLevelResolutionOpcodes.Component, expr, (component: CompileTimeComponent) => {
        InvokeComponent(op, component, null, positional, hashToArgs(named), blocks);
      });
    } else {
      InvokeDynamicComponent(op, expr, null, positional, named, blocks, false, false);
    }
  });

  statements.add(SexpOpcodes.InElement, (op, [, block, guid, destination, insertBefore]) => {
    ReplayableIf(
      op,

      () => {
        expr(op, guid);

        if (insertBefore === undefined) {
          PushPrimitiveReference(op, undefined);
        } else {
          expr(op, insertBefore);
        }

        expr(op, destination);
        op(Op.Dup, $sp, 0);

        return 4;
      },

      () => {
        op(Op.PushRemoteElement);
        InvokeStaticBlock(op, block);
        op(Op.PopRemoteElement);
      }
    );
  });

  statements.add(SexpOpcodes.HandleError, (op, [, handler, block, _inverse]) => {
    op.labels(() => {
      Replayable(
        op,
        () => {
          expr(op, handler);
          op(Op.PushBegin);
          return 2;
        },
        () => {
          op(Op.AssertSame);
          op(Op.Begin, op.target('CATCH'));
          InvokeStaticBlock(op, block);
          op(Op.Finally);
          op(Op.Jump, op.target('FINALLY'));
          op.label('CATCH');
          op.label('FINALLY');
        }
      );
      // ReplayableIf(
      //   op,
      //   () => {
      //     PushPrimitive(op, true);
      //     op(Op.PrimitiveReference);
      //     return 1;
      //   },
      //   () => {
      //     InvokeStaticBlock(op, block);
      //     op(Op.PopTryFrame);
      //     // Jump over the catch block
      //     op(Op.Jump, op.target('FINALLY'));
      //   }
      // );
    });
  });

  statements.add(SexpOpcodes.If, (op, [, condition, block, inverse]) =>
    ReplayableIf(
      op,
      () => {
        expr(op, condition);
        op(Op.ToBoolean);

        return 1;
      },

      () => {
        InvokeStaticBlock(op, block);
      },

      inverse
        ? () => {
            InvokeStaticBlock(op, inverse);
          }
        : undefined
    )
  );

  statements.add(SexpOpcodes.Each, (op, [, value, key, block, inverse]) =>
    Replayable(
      op,

      () => {
        if (key) {
          expr(op, key);
        } else {
          PushPrimitiveReference(op, null);
        }

        expr(op, value);

        return 2;
      },

      () => {
        op(Op.EnterList, labelOperand('BODY'), labelOperand('ELSE'));
        op(Op.PushFrame);
        op(Op.Dup, $fp, 1);
        op(Op.ReturnTo, labelOperand('ITER'));
        op(HighLevelBuilderOpcodes.Label, 'ITER');
        op(Op.Iterate, labelOperand('BREAK'));
        op(HighLevelBuilderOpcodes.Label, 'BODY');
        InvokeStaticBlockWithStack(op, block, 2);
        op(Op.Pop, 2);
        op(Op.Jump, labelOperand('FINALLY'));
        op(HighLevelBuilderOpcodes.Label, 'BREAK');
        op(Op.PopFrame);
        op(Op.ExitList);
        op(Op.Jump, labelOperand('FINALLY'));
        op(HighLevelBuilderOpcodes.Label, 'ELSE');

        if (inverse) {
          InvokeStaticBlock(op, inverse);
        }
      }
    )
  );

  statements.add(SexpOpcodes.With, (op, [, value, block, inverse]) => {
    ReplayableIf(
      op,

      () => {
        expr(op, value);
        op(Op.Dup, $sp, 0);
        op(Op.ToBoolean);

        return 2;
      },

      () => {
        InvokeStaticBlockWithStack(op, block, 1);
      },

      () => {
        if (inverse) {
          InvokeStaticBlock(op, inverse);
        }
      }
    );
  });

  statements.add(SexpOpcodes.Let, (op, [, positional, block]) => {
    let count = CompilePositional(op, positional);
    InvokeStaticBlockWithStack(op, block, count);
  });

  statements.add(SexpOpcodes.WithDynamicVars, (op, [, named, block]) => {
    if (named) {
      let [names, expressions] = named;

      CompilePositional(op, expressions);
      DynamicScope(op, names, () => {
        InvokeStaticBlock(op, block);
      });
    } else {
      InvokeStaticBlock(op, block);
    }
  });

  statements.add(SexpOpcodes.InvokeComponent, (op, [, expr, positional, named, blocks]) => {
    if (isGetFreeComponent(expr)) {
      op(HighLevelResolutionOpcodes.Component, expr, (component: CompileTimeComponent) => {
        InvokeComponent(op, component, null, positional, hashToArgs(named), blocks);
      });
    } else {
      InvokeDynamicComponent(op, expr, null, positional, named, blocks, false, false);
    }
  });
}

function hashToArgs(hash: WireFormat.Core.Hash | null): WireFormat.Core.Hash | null {
  if (hash === null) return null;
  let names = hash[0].map((key) => `@${key}`);
  return [names as [string, ...string[]], hash[1]];
}
