import type { BlockMetadata, EvaluationContext } from '@glimmer/interfaces';
import {
  VM_APPEND_DOCUMENT_FRAGMENT_OP,
  VM_APPEND_HTML_OP,
  VM_APPEND_NODE_OP,
  VM_APPEND_SAFE_HTML_OP,
  VM_APPEND_TEXT_OP,
  VM_ASSERT_SAME_OP,
  VM_CONTENT_TYPE_OP,
  VM_DUP_FP_OP,
  VM_DYNAMIC_HELPER_OP,
  VM_ENTER_OP,
  VM_EXIT_OP,
  VM_JUMP_EQ_OP,
  VM_JUMP_OP,
  VM_MAIN_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_PUSH_EMPTY_ARGS_OP,
  VM_PUSH_FRAME_OP,
  VM_RESOLVE_COMPONENT_DEFINITION,
  VM_RETURN_SUB_OP,
} from '@glimmer/constants';
import { $s0, ContentType } from '@glimmer/vm';

import { EncodeOp, EncoderImpl } from '../encoder';
import { StdLib } from '../stdlib';
import { InvokeBareComponent, invokePreparedComponent } from './components';

export function main(encode: EncodeOp): void {
  encode.op(VM_MAIN_OP, $s0);
  invokePreparedComponent(encode, false, false, true);
}

// Shared append operations
function appendString(encode: EncodeOp, trusting: boolean): void {
  encode.op(VM_POP_OP, 1);
  if (trusting) {
    encode.op(VM_ASSERT_SAME_OP);
    encode.op(VM_APPEND_HTML_OP);
  } else {
    encode.op(VM_APPEND_TEXT_OP);
  }
}

function appendSafeString(encode: EncodeOp): void {
  encode.op(VM_POP_OP, 1);
  encode.op(VM_ASSERT_SAME_OP);
  encode.op(VM_APPEND_SAFE_HTML_OP);
}

function appendFragment(encode: EncodeOp): void {
  encode.op(VM_POP_OP, 1);
  encode.op(VM_ASSERT_SAME_OP);
  encode.op(VM_APPEND_DOCUMENT_FRAGMENT_OP);
}

function appendNode(encode: EncodeOp): void {
  encode.op(VM_POP_OP, 1);
  encode.op(VM_ASSERT_SAME_OP);
  encode.op(VM_APPEND_NODE_OP);
}

function appendAsText(encode: EncodeOp): void {
  encode.op(VM_POP_OP, 1);
  encode.op(VM_APPEND_TEXT_OP);
}

interface AppendContentOptions {
  trusting: boolean;
  labelPrefix: string;
  endLabel: string;
  componentHandler?: () => void;
  helperHandler?: () => void;
}

// Core content type dispatch logic shared between StdAppend and StdDynamicHelperAppend
function appendContentByType(encode: EncodeOp, options: AppendContentOptions): void {
  const { trusting, labelPrefix, endLabel, componentHandler, helperHandler } = options;

  // Check content type and create jump table
  encode.op(VM_CONTENT_TYPE_OP);

  // Jump to appropriate handler based on content type
  encode.op(VM_JUMP_EQ_OP, encode.to(`${labelPrefix}_STRING`), ContentType.String);
  encode.op(VM_JUMP_EQ_OP, encode.to(`${labelPrefix}_SAFE_STRING`), ContentType.SafeString);
  encode.op(VM_JUMP_EQ_OP, encode.to(`${labelPrefix}_FRAGMENT`), ContentType.Fragment);
  encode.op(VM_JUMP_EQ_OP, encode.to(`${labelPrefix}_NODE`), ContentType.Node);
  encode.op(VM_JUMP_EQ_OP, encode.to(`${labelPrefix}_COMPONENT`), ContentType.Component);
  encode.op(VM_JUMP_EQ_OP, encode.to(`${labelPrefix}_HELPER`), ContentType.Helper);

  // Default - append as text
  appendAsText(encode);
  encode.op(VM_JUMP_OP, encode.to(endLabel));

  // String handling
  encode.mark(`${labelPrefix}_STRING`);
  appendString(encode, trusting);
  encode.op(VM_JUMP_OP, encode.to(endLabel));

  // SafeString handling
  encode.mark(`${labelPrefix}_SAFE_STRING`);
  appendSafeString(encode);
  encode.op(VM_JUMP_OP, encode.to(endLabel));

  // Fragment handling
  encode.mark(`${labelPrefix}_FRAGMENT`);
  appendFragment(encode);
  encode.op(VM_JUMP_OP, encode.to(endLabel));

  // Node handling
  encode.mark(`${labelPrefix}_NODE`);
  appendNode(encode);
  encode.op(VM_JUMP_OP, encode.to(endLabel));

  // Component handling
  encode.mark(`${labelPrefix}_COMPONENT`);
  if (componentHandler) {
    componentHandler();
  } else {
    appendAsText(encode);
  }
  encode.op(VM_JUMP_OP, encode.to(endLabel));

  // Helper handling
  encode.mark(`${labelPrefix}_HELPER`);
  if (helperHandler) {
    helperHandler();
  } else {
    appendAsText(encode);
  }
  encode.op(VM_JUMP_OP, encode.to(endLabel));
}

/**
 * Append content to the DOM. This standard function triages content and does the
 * right thing based upon whether it's a string, safe string, component, fragment
 * or node.
 *
 * @param trusting whether to interpolate a string as raw HTML (corresponds to
 * triple curlies)
 */
/**
 * Handle the result of a dynamic helper call by checking its content type
 * and appending it appropriately. This handles helper-returns-helper by
 * calling nested helpers with empty args.
 *
 * Expects the helper result to be on the stack.
 */
export function StdDynamicHelperAppend(encode: EncodeOp, trusting: boolean): void {
  encode.startLabels();

  appendContentByType(encode, {
    trusting,
    labelPrefix: 'DYN_HELPER',
    endLabel: 'DYN_HELPER_END',
    helperHandler: () => {
      encode.op(VM_POP_OP, 1);
      // This is where we handle nested helpers - call with empty args
      encode.op(VM_PUSH_FRAME_OP);
      encode.op(VM_PUSH_EMPTY_ARGS_OP);
      encode.op(VM_DYNAMIC_HELPER_OP);
      // Duplicate the result before popping frame
      encode.op(VM_DUP_FP_OP, -1);
      encode.op(VM_POP_FRAME_OP);
      // The result should be appended as text (no more recursion)
      encode.op(VM_APPEND_TEXT_OP);
    },
  });

  encode.mark('DYN_HELPER_END');
  encode.stopLabels();

  // End with RETURN_SUB to return from this stdlib routine
  encode.op(VM_RETURN_SUB_OP);
}

export function StdAppend(
  encode: EncodeOp,
  trusting: boolean,
  nonDynamicAppend: number | null
): void {
  encode.op(VM_ENTER_OP, 1);
  encode.startLabels();

  if (typeof nonDynamicAppend === 'number') {
    // When we have nonDynamicAppend, we can invoke components and handle nested helpers
    appendContentByType(encode, {
      trusting,
      labelPrefix: 'APPEND',
      endLabel: 'END',
      componentHandler: () => {
        encode.op(VM_POP_OP, 1);
        encode.op(VM_RESOLVE_COMPONENT_DEFINITION);
        InvokeBareComponent(encode);
      },
      helperHandler: () => {
        encode.op(VM_POP_OP, 1);
        // Call the dynamic helper with empty args
        encode.op(VM_PUSH_FRAME_OP);
        encode.op(VM_PUSH_EMPTY_ARGS_OP);
        encode.op(VM_DYNAMIC_HELPER_OP);
        encode.op(VM_POP_FRAME_OP);

        // Now check what the helper returned and append it
        appendContentByType(encode, {
          trusting,
          labelPrefix: 'NESTED',
          endLabel: 'END',
          componentHandler: () => {
            encode.op(VM_POP_OP, 1);
            encode.op(VM_RESOLVE_COMPONENT_DEFINITION);
            InvokeBareComponent(encode);
          },
          helperHandler: () => {
            encode.op(VM_POP_OP, 1);
            // Call the nested helper with empty args
            encode.op(VM_PUSH_FRAME_OP);
            encode.op(VM_PUSH_EMPTY_ARGS_OP);
            encode.op(VM_DYNAMIC_HELPER_OP);
            encode.op(VM_POP_FRAME_OP);
            // The result should be appended as text (no more recursion)
            encode.op(VM_APPEND_TEXT_OP);
          },
        });
      },
    });
  } else {
    // Without nonDynamicAppend, components and helpers are just appended as text
    appendContentByType(encode, {
      trusting,
      labelPrefix: 'APPEND',
      endLabel: 'END',
    });
  }

  encode.mark('END');
  encode.stopLabels();
  encode.op(VM_EXIT_OP);
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

  let trustingDynamicHelperAppend = build(context, (op) => StdDynamicHelperAppend(op, true));
  let cautiousDynamicHelperAppend = build(context, (op) => StdDynamicHelperAppend(op, false));

  return new StdLib(
    mainHandle,
    trustingGuardedDynamicAppend,
    cautiousGuardedDynamicAppend,
    trustingGuardedNonDynamicAppend,
    cautiousGuardedNonDynamicAppend,
    trustingDynamicHelperAppend,
    cautiousDynamicHelperAppend
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
