import type {
  CapabilityMask,
  CompilableProgram,
  CompileTimeComponent,
  LayoutWithContext,
  NamedBlocks,
  Nullable,
  WireFormat,
} from '@glimmer/interfaces';
import { hasCapability } from '@glimmer/manager';
import { EMPTY_STRING_ARRAY, reverse, unwrap } from '@glimmer/util';
import {
  $s0,
  $s1,
  $sp,
  BEGIN_COMPONENT_TRANSACTION_OP,
  CONSTANT_OP,
  CREATE_COMPONENT_OP,
  DID_CREATE_ELEMENT_OP,
  DID_RENDER_LAYOUT_OP,
  DUP_OP,
  FETCH_OP,
  GET_COMPONENT_LAYOUT_OP,
  GET_COMPONENT_SELF_OP,
  GET_COMPONENT_TAG_NAME_OP,
  INVOKE_COMPONENT_LAYOUT_OP,
  INVOKE_VIRTUAL_OP,
  JUMP_UNLESS_OP,
  LOAD_OP,
  POPULATE_LAYOUT_OP,
  POP_OP,
  PREPARE_ARGS_OP,
  PUSH_ARGS_OP,
  PUSH_COMPONENT_DEFINITION_OP,
  PUSH_SYMBOL_TABLE_OP,
  REGISTER_COMPONENT_DESTRUCTOR_OP,
  RESOLVE_DYNAMIC_COMPONENT_OP,
  ROOT_SCOPE_OP,
  SET_BLOCKS_OP,
  SET_BLOCK_OP,
  SET_NAMED_VARIABLES_OP,
  SET_VARIABLE_OP,
  VIRTUAL_ROOT_SCOPE_OP,
  type SavedRegister,
  RESOLVE_CURRIED_COMPONENT_OP,
  PUSH_DYNAMIC_COMPONENT_INSTANCE_OP,
  CLOSE_ELEMENT_OP,
  COMMIT_COMPONENT_TRANSACTION_OP,
  COMPILE_BLOCK_OP,
  FLUSH_ELEMENT_OP,
  OPEN_DYNAMIC_ELEMENT_OP,
  POP_DYNAMIC_SCOPE_OP,
  POP_SCOPE_OP,
  PRIMITIVE_REFERENCE_OP,
  PUSH_DYNAMIC_SCOPE_OP,
  PUSH_EMPTY_ARGS_OP,
  PUT_COMPONENT_OPERATIONS_OP,
  PREPARE_ARGS_CAPABILITY,
  CREATE_ARGS_CAPABILITY,
  DYNAMIC_SCOPE_CAPABILITY,
  CREATE_INSTANCE_CAPABILITY,
  WILL_FLUSH_ELEMENT_OP,
} from '@glimmer/vm-constants';

import type { PushExpressionOp, PushStatementOp } from '../../syntax/compiler-impl';
import { namedBlocks } from '../../utils';
import { isStrictMode, labelOperand, layoutOperand, symbolTableOperand } from '../operands';
import { InvokeStaticBlock, PushYieldableBlock, YieldBlock } from './blocks';
import { Replayable } from './conditional';
import { expr } from './expr';
import { CompileArguments, CompilePositional } from './shared';
import { POP_FRAME_OP, PUSH_FRAME_OP } from '@glimmer/vm-constants';
import { LABEL_OP, START_LABELS_OP, STOP_LABELS_OP } from '../opcodes';

export const ATTRS_BLOCK = '&attrs';

interface AnyComponent {
  elementBlock: Nullable<WireFormat.SerializedInlineBlock>;
  positional: WireFormat.Core.Params;
  named: WireFormat.Core.Hash;
  blocks: NamedBlocks;
}

// {{component}}
export interface DynamicComponent extends AnyComponent {
  definition: WireFormat.Expression;
  atNames: boolean;
  curried: boolean;
}

// <Component>
export interface StaticComponent extends AnyComponent {
  capabilities: CapabilityMask;
  layout: CompilableProgram;
}

// chokepoint
export interface Component extends AnyComponent {
  // either we know the capabilities statically or we need to be conservative and assume
  // that the component requires all capabilities
  capabilities: CapabilityMask | true;

  // are the arguments supplied as atNames?
  atNames: boolean;

  // do we have the layout statically or will we need to look it up at runtime?
  layout?: CompilableProgram;
}

export function InvokeComponent(
  op: PushStatementOp,
  component: CompileTimeComponent,
  _elementBlock: WireFormat.Core.ElementParameters,
  positional: WireFormat.Core.Params,
  named: WireFormat.Core.Hash,
  _blocks: WireFormat.Core.Blocks
): void {
  let { compilable, capabilities, handle } = component;

  let elementBlock = _elementBlock
    ? ([_elementBlock, []] as WireFormat.SerializedInlineBlock)
    : null;
  let blocks = Array.isArray(_blocks) || _blocks === null ? namedBlocks(_blocks) : _blocks;

  if (compilable) {
    op(PUSH_COMPONENT_DEFINITION_OP, handle);
    InvokeStaticComponent(op, {
      capabilities: capabilities,
      layout: compilable,
      elementBlock,
      positional,
      named,
      blocks,
    });
  } else {
    op(PUSH_COMPONENT_DEFINITION_OP, handle);
    InvokeNonStaticComponent(op, {
      capabilities: capabilities,
      elementBlock,
      positional,
      named,
      atNames: true,
      blocks,
    });
  }
}

export function InvokeDynamicComponent(
  op: PushStatementOp,
  definition: WireFormat.Core.Expression,
  _elementBlock: WireFormat.Core.ElementParameters,
  positional: WireFormat.Core.Params,
  named: WireFormat.Core.Hash,
  _blocks: WireFormat.Core.Blocks,
  atNames: boolean,
  curried: boolean
): void {
  let elementBlock = _elementBlock
    ? ([_elementBlock, []] as WireFormat.SerializedInlineBlock)
    : null;
  let blocks = Array.isArray(_blocks) || _blocks === null ? namedBlocks(_blocks) : _blocks;

  Replayable(
    op,

    () => {
      expr(op, definition);
      op(DUP_OP, $sp, 0);
      return 2;
    },

    () => {
      op(JUMP_UNLESS_OP, labelOperand('ELSE'));

      if (curried) {
        op(RESOLVE_CURRIED_COMPONENT_OP);
      } else {
        op(RESOLVE_DYNAMIC_COMPONENT_OP, isStrictMode());
      }

      op(PUSH_DYNAMIC_COMPONENT_INSTANCE_OP);
      InvokeNonStaticComponent(op, {
        capabilities: true,
        elementBlock,
        positional,
        named,
        atNames,
        blocks,
      });
      op(LABEL_OP, 'ELSE');
    }
  );
}

function InvokeStaticComponent(
  op: PushStatementOp,
  { capabilities, layout, elementBlock, positional, named, blocks }: StaticComponent
): void {
  let { symbolTable } = layout;

  let bailOut = symbolTable.hasDebug || hasCapability(capabilities, PREPARE_ARGS_CAPABILITY);

  if (bailOut) {
    InvokeNonStaticComponent(op, {
      capabilities,
      elementBlock,
      positional,
      named,
      atNames: true,
      blocks,
      layout,
    });

    return;
  }

  op(FETCH_OP, $s0);
  op(DUP_OP, $sp, 1);
  op(LOAD_OP, $s0);
  op(PUSH_FRAME_OP);

  // Setup arguments
  let { symbols } = symbolTable;

  // As we push values onto the stack, we store the symbols associated  with them
  // so that we can set them on the scope later on with SetVariable and SetBlock
  let blockSymbols: number[] = [];
  let argumentSymbols: number[] = [];
  let argumentNames: string[] = [];

  // First we push the blocks onto the stack
  let blockNames = blocks.names;

  // Starting with the attrs block, if it exists and is referenced in the component
  if (elementBlock !== null) {
    let symbol = symbols.indexOf(ATTRS_BLOCK);

    if (symbol !== -1) {
      PushYieldableBlock(op, elementBlock);
      blockSymbols.push(symbol);
    }
  }

  // Followed by the other blocks, if they exist and are referenced in the component.
  // Also store the index of the associated symbol.
  for (let name of blockNames) {
    let symbol = symbols.indexOf(`&${name}`);

    if (symbol !== -1) {
      PushYieldableBlock(op, blocks.get(name));
      blockSymbols.push(symbol);
    }
  }

  // Next up we have arguments. If the component has the `createArgs` capability,
  // then it wants access to the arguments in JavaScript. We can't know whether
  // or not an argument is used, so we have to give access to all of them.
  if (hasCapability(capabilities, CREATE_ARGS_CAPABILITY)) {
    // First we push positional arguments
    let count = CompilePositional(op, positional);

    // setup the flags with the count of positionals, and to indicate that atNames
    // are used
    let flags = count << 4;
    flags |= 0b1000;

    let names: string[] = EMPTY_STRING_ARRAY;

    // Next, if named args exist, push them all. If they have an associated symbol
    // in the invoked component (e.g. they are used within its template), we push
    // that symbol. If not, we still push the expression as it may be used, and
    // we store the symbol as -1 (this is used later).
    if (named !== null) {
      names = named[0];
      let value = named[1];

      for (let [index, element] of value.entries()) {
        let symbol = symbols.indexOf(unwrap(names[index]));

        expr(op, element);
        argumentSymbols.push(symbol);
      }
    }

    // Finally, push the VM arguments themselves. These args won't need access
    // to blocks (they aren't accessible from userland anyways), so we push an
    // empty array instead of the actual block names.
    op(PUSH_ARGS_OP, names, EMPTY_STRING_ARRAY, flags);

    // And push an extra pop operation to remove the args before we begin setting
    // variables on the local context
    argumentSymbols.push(-1);
  } else if (named !== null) {
    // If the component does not have the `createArgs` capability, then the only
    // expressions we need to push onto the stack are those that are actually
    // referenced in the template of the invoked component (e.g. have symbols).
    let names = named[0];
    let value = named[1];

    for (let [index, element] of value.entries()) {
      let name = unwrap(names[index]);
      let symbol = symbols.indexOf(name);

      if (symbol !== -1) {
        expr(op, element);
        argumentSymbols.push(symbol);
        argumentNames.push(name);
      }
    }
  }

  op(BEGIN_COMPONENT_TRANSACTION_OP, $s0);

  if (hasCapability(capabilities, DYNAMIC_SCOPE_CAPABILITY)) {
    op(PUSH_DYNAMIC_SCOPE_OP);
  }

  if (hasCapability(capabilities, CREATE_INSTANCE_CAPABILITY)) {
    op(CREATE_COMPONENT_OP, Math.trunc(blocks.has('default') as any), $s0);
  }

  op(REGISTER_COMPONENT_DESTRUCTOR_OP, $s0);

  if (hasCapability(capabilities, CREATE_ARGS_CAPABILITY)) {
    op(GET_COMPONENT_SELF_OP, $s0);
  } else {
    op(GET_COMPONENT_SELF_OP, $s0, argumentNames);
  }

  // Setup the new root scope for the component
  op(ROOT_SCOPE_OP, symbols.length + 1, Object.keys(blocks).length > 0 ? 1 : 0);

  // Pop the self reference off the stack and set it to the symbol for `this`
  // in the new scope. This is why all subsequent symbols are increased by one.
  op(SET_VARIABLE_OP, 0);

  // Going in reverse, now we pop the args/blocks off the stack, starting with
  // arguments, and assign them to their symbols in the new scope.
  for (let symbol of reverse(argumentSymbols)) {
    // for (let i = argSymbols.length - 1; i >= 0; i--) {
    //   let symbol = argSymbols[i];

    if (symbol === -1) {
      // The expression was not bound to a local symbol, it was only pushed to be
      // used with VM args in the javascript side
      op(POP_OP, 1);
    } else {
      op(SET_VARIABLE_OP, symbol + 1);
    }
  }

  // if any positional params exist, pop them off the stack as well
  if (positional !== null) {
    op(POP_OP, positional.length);
  }

  // Finish up by popping off and assigning blocks
  for (let symbol of reverse(blockSymbols)) {
    op(SET_BLOCK_OP, symbol + 1);
  }

  op(CONSTANT_OP, layoutOperand(layout));
  op(COMPILE_BLOCK_OP);
  op(INVOKE_VIRTUAL_OP);
  op(DID_RENDER_LAYOUT_OP, $s0);

  op(POP_FRAME_OP);
  op(POP_SCOPE_OP);

  if (hasCapability(capabilities, DYNAMIC_SCOPE_CAPABILITY)) {
    op(POP_DYNAMIC_SCOPE_OP);
  }

  op(COMMIT_COMPONENT_TRANSACTION_OP);
  op(LOAD_OP, $s0);
}

export function InvokeNonStaticComponent(
  op: PushStatementOp,
  { capabilities, elementBlock, positional, named, atNames, blocks: namedBlocks, layout }: Component
): void {
  let bindableBlocks = !!namedBlocks;
  let bindableAtNames =
    capabilities === true ||
    !!hasCapability(capabilities, PREPARE_ARGS_CAPABILITY) ||
    !!(named && named[0].length > 0);

  let blocks = namedBlocks.with('attrs', elementBlock);

  op(FETCH_OP, $s0);
  op(DUP_OP, $sp, 1);
  op(LOAD_OP, $s0);

  op(PUSH_FRAME_OP);
  CompileArguments(op, positional, named, blocks, atNames);
  op(PREPARE_ARGS_OP, $s0);

  invokePreparedComponent(op, blocks.has('default'), bindableBlocks, bindableAtNames, () => {
    if (layout) {
      op(PUSH_SYMBOL_TABLE_OP, symbolTableOperand(layout.symbolTable));
      op(CONSTANT_OP, layoutOperand(layout));
      op(COMPILE_BLOCK_OP);
    } else {
      op(GET_COMPONENT_LAYOUT_OP, $s0);
    }

    op(POPULATE_LAYOUT_OP, $s0);
  });

  op(LOAD_OP, $s0);
}

export function WrappedComponent(
  op: PushStatementOp,
  layout: LayoutWithContext,
  attributesBlockNumber: number
): void {
  op(START_LABELS_OP);
  WithSavedRegister(op, $s1, () => {
    op(GET_COMPONENT_TAG_NAME_OP, $s0);
    op(PRIMITIVE_REFERENCE_OP);
    op(DUP_OP, $sp, 0);
  });
  op(JUMP_UNLESS_OP, labelOperand('BODY'));
  op(FETCH_OP, $s1);
  op(PUT_COMPONENT_OPERATIONS_OP);
  op(OPEN_DYNAMIC_ELEMENT_OP);
  op(DID_CREATE_ELEMENT_OP, $s0);
  YieldBlock(op, attributesBlockNumber, null);
  op(WILL_FLUSH_ELEMENT_OP, $s0);
  op(FLUSH_ELEMENT_OP);
  op(LABEL_OP, 'BODY');
  InvokeStaticBlock(op, [layout.block[0], []]);
  op(FETCH_OP, $s1);
  op(JUMP_UNLESS_OP, labelOperand('END'));
  op(CLOSE_ELEMENT_OP);
  op(LABEL_OP, 'END');
  op(LOAD_OP, $s1);
  op(STOP_LABELS_OP);
}

export function invokePreparedComponent(
  op: PushStatementOp,
  hasBlock: boolean,
  bindableBlocks: boolean,
  bindableAtNames: boolean,
  populateLayout: Nullable<() => void> = null
): void {
  op(BEGIN_COMPONENT_TRANSACTION_OP, $s0);
  op(PUSH_DYNAMIC_SCOPE_OP);

  op(CREATE_COMPONENT_OP, Math.trunc(hasBlock as any), $s0);

  // this has to run after createComponent to allow
  // for late-bound layouts, but a caller is free
  // to populate the layout earlier if it wants to
  // and do nothing here.
  if (populateLayout) {
    populateLayout();
  }

  op(REGISTER_COMPONENT_DESTRUCTOR_OP, $s0);
  op(GET_COMPONENT_SELF_OP, $s0);

  op(VIRTUAL_ROOT_SCOPE_OP, $s0);
  op(SET_VARIABLE_OP, 0);

  if (bindableAtNames) op(SET_NAMED_VARIABLES_OP, $s0);
  if (bindableBlocks) op(SET_BLOCKS_OP, $s0);

  op(POP_OP, 1);
  op(INVOKE_COMPONENT_LAYOUT_OP, $s0);
  op(DID_RENDER_LAYOUT_OP, $s0);
  op(POP_FRAME_OP);

  op(POP_SCOPE_OP);
  op(POP_DYNAMIC_SCOPE_OP);
  op(COMMIT_COMPONENT_TRANSACTION_OP);
}

export function InvokeBareComponent(op: PushStatementOp): void {
  op(FETCH_OP, $s0);
  op(DUP_OP, $sp, 1);
  op(LOAD_OP, $s0);

  op(PUSH_FRAME_OP);
  op(PUSH_EMPTY_ARGS_OP);
  op(PREPARE_ARGS_OP, $s0);
  invokePreparedComponent(op, false, false, true, () => {
    op(GET_COMPONENT_LAYOUT_OP, $s0);
    op(POPULATE_LAYOUT_OP, $s0);
  });
  op(LOAD_OP, $s0);
}

export function WithSavedRegister(
  op: PushExpressionOp,
  register: SavedRegister,
  block: () => void
): void {
  op(FETCH_OP, register);
  block();
  op(LOAD_OP, register);
}
