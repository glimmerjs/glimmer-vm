import type {
  BuilderOp,
  CompileTimeCompilationContext,
  ContainingMetadata,
  HighLevelOp,
  STDLib,
} from '@glimmer/interfaces';
import {
  $s0,
  APPEND_DOCUMENT_FRAGMENT_OP,
  APPEND_HTML_OP,
  APPEND_NODE_OP,
  APPEND_SAFE_HTML_OP,
  APPEND_TEXT_OP,
  ASSERT_SAME_OP,
  CONTENT_TYPE_OP,
  INVOKE_STATIC_OP,
  MAIN_OP,
  PUSH_DYNAMIC_COMPONENT_INSTANCE_OP,
  RESOLVE_CURRIED_COMPONENT_OP,

  COMPONENT_CONTENT,
  FRAGMENT_CONTENT,
  HELPER_CONTENT,
  NODE_CONTENT,
  SAFE_STRING_CONTENT,
  STRING_CONTENT,
} from '@glimmer/vm-constants';

import type { HighLevelStatementOp, PushStatementOp } from '../../syntax/compiler-impl';
import { encodeOp, EncoderImpl } from '../encoder';
import { InvokeBareComponent, invokePreparedComponent } from './components';
import { SwitchCases } from './conditional';
import { CallDynamic } from './vm';

export function main(op: PushStatementOp): void {
  op(MAIN_OP, $s0);
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
    () => op(CONTENT_TYPE_OP),
    (when) => {
      when(STRING_CONTENT, () => {
        if (trusting) {
          op(ASSERT_SAME_OP);
          op(APPEND_HTML_OP);
        } else {
          op(APPEND_TEXT_OP);
        }
      });

      if (typeof nonDynamicAppend === 'number') {
        when(COMPONENT_CONTENT, () => {
          op(RESOLVE_CURRIED_COMPONENT_OP);
          op(PUSH_DYNAMIC_COMPONENT_INSTANCE_OP);
          InvokeBareComponent(op);
        });

        when(HELPER_CONTENT, () => {
          CallDynamic(op, null, null, () => {
            op(INVOKE_STATIC_OP, nonDynamicAppend);
          });
        });
      } else {
        // when non-dynamic, we can no longer call the value (potentially because we've already called it)
        // this prevents infinite loops. We instead coerce the value, whatever it is, into the DOM.
        when(COMPONENT_CONTENT, () => {
          op(APPEND_TEXT_OP);
        });

        when(HELPER_CONTENT, () => {
          op(APPEND_TEXT_OP);
        });
      }

      when(SAFE_STRING_CONTENT, () => {
        op(ASSERT_SAME_OP);
        op(APPEND_SAFE_HTML_OP);
      });

      when(FRAGMENT_CONTENT, () => {
        op(ASSERT_SAME_OP);
        op(APPEND_DOCUMENT_FRAGMENT_OP);
      });

      when(NODE_CONTENT, () => {
        op(ASSERT_SAME_OP);
        op(APPEND_NODE_OP);
      });
    }
  );
}

export function compileStd(context: CompileTimeCompilationContext): STDLib {
  let mainHandle = build(context, (op) => main(op));
  let trustingGuardedNonDynamicAppend = build(context, (op) => StdAppend(op, true, null));
  let cautiousGuardedNonDynamicAppend = build(context, (op) => StdAppend(op, false, null));

  let trustingGuardedDynamicAppend = build(context, (op) =>
    StdAppend(op, true, trustingGuardedNonDynamicAppend)
  );
  let cautiousGuardedDynamicAppend = build(context, (op) =>
    StdAppend(op, false, cautiousGuardedNonDynamicAppend)
  );

  return [
    mainHandle,
    trustingGuardedDynamicAppend,
    cautiousGuardedDynamicAppend,
    trustingGuardedNonDynamicAppend,
    cautiousGuardedNonDynamicAppend,
  ];
}

export const STDLIB_META: ContainingMetadata = {
  evalSymbols: null,
  upvars: null,
  moduleName: 'stdlib',

  // TODO: ??
  scopeValues: null,
  isStrictMode: true,
  owner: null,
  size: 0,
};

function build(
  program: CompileTimeCompilationContext,
  builder: (op: PushStatementOp) => void
): number {
  let { constants, heap, resolver } = program;
  let encoder = new EncoderImpl(heap, STDLIB_META);

  function pushOp(...op: BuilderOp | HighLevelOp | HighLevelStatementOp) {
    encodeOp(encoder, constants, resolver, STDLIB_META, op as BuilderOp | HighLevelOp);
  }

  builder(pushOp);

  let result = encoder.commit(0);

  if (typeof result !== 'number') {
    // This shouldn't be possible
    throw new Error(`Unexpected errors compiling std`);
  } else {
    return result;
  }
}
