import type { BlockMetadata, BuilderOp, HighLevelOp, JitContext } from '@glimmer/interfaces';
import { $s0, Op } from '@glimmer/vm';
import {
  COMPONENT_CONTENT,
  FRAGMENT_CONTENT,
  HELPER_CONTENT,
  NODE_CONTENT,
  SAFE_STRING_CONTENT,
  STRING_CONTENT,
} from '@glimmer/vm/lib/content';

import type { HighLevelStatementOp, PushStatementOp } from '../../syntax/compilers';

import { definePushOp } from '../../syntax/compilers';
import { encodeOp, EncoderImpl } from '../encoder';
import { StdLib } from '../stdlib';
import { InvokeBareComponent, invokePreparedComponent } from './components';
import { SwitchCases } from './conditional';
import { CallDynamic } from './vm';

export function main(op: PushStatementOp): void {
  op(Op.Main, $s0);
  invokePreparedComponent(op, false, false, true);
}

/**
 * Append content to the DOM. This standard function triages content and does the
 * right thing based upon whether it's a string, safe string, component, fragment
 * or node.
 *
 * @param trusting whether to interpolate a string as raw HTML (corresponds to
 * triple curlies)
 */
export function StdAppend(
  op: PushStatementOp,
  trusting: boolean,
  nonDynamicAppend: number | null
): void {
  SwitchCases(
    op,
    () => op(Op.ContentType),
    (when) => {
      when(STRING_CONTENT, () => {
        if (trusting) {
          op(Op.AssertSame);
          op(Op.AppendHTML);
        } else {
          op(Op.AppendText);
        }
      });

      if (typeof nonDynamicAppend === 'number') {
        when(COMPONENT_CONTENT, () => {
          op(Op.ResolveCurriedComponent);
          op(Op.PushDynamicComponentInstance);
          InvokeBareComponent(op);
        });

        when(HELPER_CONTENT, () => {
          CallDynamic(op, null, null, () => {
            op(Op.InvokeStatic, nonDynamicAppend);
          });
        });
      } else {
        // when non-dynamic, we can no longer call the value (potentially because we've already called it)
        // this prevents infinite loops. We instead coerce the value, whatever it is, into the DOM.
        when(COMPONENT_CONTENT, () => {
          op(Op.AppendText);
        });

        when(HELPER_CONTENT, () => {
          op(Op.AppendText);
        });
      }

      when(SAFE_STRING_CONTENT, () => {
        op(Op.AssertSame);
        op(Op.AppendSafeHTML);
      });

      when(FRAGMENT_CONTENT, () => {
        op(Op.AssertSame);
        op(Op.AppendDocumentFragment);
      });

      when(NODE_CONTENT, () => {
        op(Op.AssertSame);
        op(Op.AppendNode);
      });
    }
  );
}

export function compileStd(context: JitContext): StdLib {
  let mainHandle = build(context, (op) => main(op));
  let trustingGuardedNonDynamicAppend = build(context, (op) => StdAppend(op, true, null));
  let cautiousGuardedNonDynamicAppend = build(context, (op) => StdAppend(op, false, null));

  let trustingGuardedDynamicAppend = build(context, (op) =>
    StdAppend(op, true, trustingGuardedNonDynamicAppend)
  );
  let cautiousGuardedDynamicAppend = build(context, (op) =>
    StdAppend(op, false, cautiousGuardedNonDynamicAppend)
  );

  return new StdLib(
    mainHandle,
    trustingGuardedDynamicAppend,
    cautiousGuardedDynamicAppend,
    trustingGuardedNonDynamicAppend,
    cautiousGuardedNonDynamicAppend
  );
}

export const STDLIB_META: BlockMetadata = {
  debugSymbols: null,
  upvars: null,
  moduleName: 'stdlib',

  // TODO: ??
  scopeValues: null,
  isStrictMode: true,
  owner: null,
  size: 0,
};

function build(program: JitContext, builder: (op: PushStatementOp) => void): number {
  let { constants, heap, resolver } = program;
  let encoder = new EncoderImpl(heap, STDLIB_META);

  function pushOp(...op: BuilderOp | HighLevelOp | HighLevelStatementOp) {
    encodeOp(encoder, constants, resolver, STDLIB_META, op as BuilderOp | HighLevelOp);
  }

  builder(definePushOp(pushOp));

  let result = encoder.commit(0);

  if (typeof result !== 'number') {
    // This shouldn't be possible
    throw new Error(`Unexpected errors compiling std`);
  } else {
    return result;
  }
}
