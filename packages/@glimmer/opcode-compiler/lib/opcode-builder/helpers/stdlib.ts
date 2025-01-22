import type { BlockMetadata, EvaluationContext } from '@glimmer/interfaces';
import {
  VM_APPEND_DOCUMENT_FRAGMENT_OP,
  VM_APPEND_HTML_OP,
  VM_APPEND_NODE_OP,
  VM_APPEND_SAFE_HTML_OP,
  VM_APPEND_TEXT_OP,
  VM_ASSERT_SAME_OP,
  VM_CONTENT_TYPE_OP,
  VM_MAIN_OP,
  VM_RESOLVE_COMPONENT_DEFINITION,
} from '@glimmer/constants';
import { $s0, ContentType } from '@glimmer/vm';
import { EMPTY_ARGS_OPCODE } from '@glimmer/wire-format';

import { EncodeOp, EncoderImpl } from '../encoder';
import { StdLib } from '../stdlib';
import { InvokeBareComponent, invokePreparedComponent } from './components';
import { SwitchCases } from './conditional';
import { CallDynamicBlock } from './vm';

export function main(encode: EncodeOp): void {
  encode.op(VM_MAIN_OP, $s0);
  invokePreparedComponent(encode, false, false, true);
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
  encode: EncodeOp,
  trusting: boolean,
  nonDynamicAppend: number | null
): void {
  SwitchCases(
    encode,
    () => encode.op(VM_CONTENT_TYPE_OP),
    (when) => {
      when(ContentType.String, () => {
        if (trusting) {
          encode.op(VM_ASSERT_SAME_OP);
          encode.op(VM_APPEND_HTML_OP);
        } else {
          encode.op(VM_APPEND_TEXT_OP);
        }
      });

      if (typeof nonDynamicAppend === 'number') {
        when(ContentType.Component, () => {
          encode.op(VM_RESOLVE_COMPONENT_DEFINITION);
          InvokeBareComponent(encode);
        });

        when(ContentType.Helper, () => {
          CallDynamicBlock(encode, nonDynamicAppend, [EMPTY_ARGS_OPCODE]);
        });
      } else {
        // when non-dynamic, we can no longer call the value (potentially because we've already called it)
        // this prevents infinite loops. We instead coerce the value, whatever it is, into the DOM.
        when(ContentType.Component, () => {
          encode.op(VM_APPEND_TEXT_OP);
        });

        when(ContentType.Helper, () => {
          encode.op(VM_APPEND_TEXT_OP);
        });
      }

      when(ContentType.SafeString, () => {
        encode.op(VM_ASSERT_SAME_OP);
        encode.op(VM_APPEND_SAFE_HTML_OP);
      });

      when(ContentType.Fragment, () => {
        encode.op(VM_ASSERT_SAME_OP);
        encode.op(VM_APPEND_DOCUMENT_FRAGMENT_OP);
      });

      when(ContentType.Node, () => {
        encode.op(VM_ASSERT_SAME_OP);
        encode.op(VM_APPEND_NODE_OP);
      });
    }
  );
}

export function compileStd(context: EvaluationContext): StdLib {
  let mainHandle = build(context, (encode) => main(encode));
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
  symbols: {
    locals: null,
    upvars: null,
  },
  moduleName: 'stdlib',

  // TODO: ??
  scopeValues: null,
  isStrictMode: true,
  owner: null,
  size: 0,
};

function build(evaluation: EvaluationContext, builder: (encode: EncodeOp) => void): number {
  let encoder = new EncoderImpl(evaluation.program.heap, STDLIB_META);
  let encode = new EncodeOp(encoder, evaluation, STDLIB_META);

  builder(encode);

  let result = encoder.commit(0);

  if (typeof result !== 'number') {
    // This shouldn't be possible
    throw new Error(`Unexpected errors compiling std`);
  } else {
    return result;
  }
}
