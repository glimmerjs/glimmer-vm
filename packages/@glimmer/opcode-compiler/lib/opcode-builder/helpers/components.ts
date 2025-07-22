import type {
  CapabilityMask,
  CompilableProgram,
  CompileTimeComponent,
  EarlyBoundCompileTimeComponent,
  LayoutWithContext,
  NamedBlocks,
  Nullable,
  Optional,
  WireFormat,
} from '@glimmer/interfaces';
import type { SavedRegister } from '@glimmer/vm';
import {
  VM_BEGIN_COMPONENT_TRANSACTION_OP,
  VM_CLOSE_ELEMENT_OP,
  VM_COMMIT_COMPONENT_TRANSACTION_OP,
  VM_COMPILE_BLOCK_OP,
  VM_CONSTANT_OP,
  VM_CREATE_COMPONENT_OP,
  VM_DID_CREATE_ELEMENT_OP,
  VM_DID_RENDER_LAYOUT_OP,
  VM_DUP_SP_OP,
  VM_FETCH_OP,
  VM_FLUSH_ELEMENT_OP,
  VM_GET_COMPONENT_LAYOUT_OP,
  VM_GET_COMPONENT_SELF_OP,
  VM_GET_COMPONENT_TAG_NAME_OP,
  VM_INVOKE_COMPONENT_LAYOUT_OP,
  VM_JIT_INVOKE_VIRTUAL_OP,
  VM_JUMP_UNLESS_OP,
  VM_LOAD_OP,
  VM_OPEN_DYNAMIC_ELEMENT_OP,
  VM_POP_DYNAMIC_SCOPE_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_POP_SCOPE_OP,
  VM_POPULATE_LAYOUT_OP,
  VM_PREPARE_ARGS_OP,
  VM_PRIMITIVE_REFERENCE_OP,
  VM_PUSH_AND_BIND_DYNAMIC_SCOPE_OP,
  VM_PUSH_ARGS_OP,
  VM_PUSH_EMPTY_ARGS_OP,
  VM_PUSH_FRAME_OP,
  VM_PUSH_SYMBOL_TABLE_OP,
  VM_PUT_COMPONENT_OPERATIONS_OP,
  VM_REGISTER_COMPONENT_DESTRUCTOR_OP,
  VM_RESOLVE_COMPONENT_DEFINITION,
  VM_RESOLVE_COMPONENT_DEFINITION_OR_STRING,
  VM_ROOT_SCOPE_OP,
  VM_SET_BLOCK_OP,
  VM_SET_BLOCKS_OP,
  VM_SET_NAMED_VARIABLES_OP,
  VM_SET_VARIABLE_OP,
  VM_VIRTUAL_ROOT_SCOPE_OP,
} from '@glimmer/constants';
import { unwrap } from '@glimmer/debug-util';
import { hasCapability } from '@glimmer/manager';
import { EMPTY_STRING_ARRAY, reverse } from '@glimmer/util';
import { $s0, $s1, InternalComponentCapabilities } from '@glimmer/vm';

import type { EncodeOp } from '../encoder';

import { EMPTY_BLOCKS, getNamedBlocks } from '../../utils';
import { InvokeStaticBlock, PushYieldableBlock, YieldBlock } from './blocks';
import { Replayable } from './conditional';
import { expr } from './expr';
import {
  CompileArgs,
  CompilePositional,
  getBlocks,
  getNamed,
  getPositional,
  hasBlocks,
  hasNamed,
  hasPositional,
} from './shared';

export const ATTRS_BLOCK = '&attrs';

interface AnyComponent {
  positional?: Optional<WireFormat.Core.Params>;
  named?: Optional<WireFormat.Core.Hash>;
  blocks: NamedBlocks;
}

// {{component}}
export interface DynamicComponent extends AnyComponent {
  definition: WireFormat.Expression;
  atNames: boolean;
  curried: boolean;
}

// <Component>
export interface StaticComponent {
  args: WireFormat.Core.BlockArgs;
  capabilities: CapabilityMask;
  layout: CompilableProgram;
}

// chokepoint
export interface Component {
  args: WireFormat.Core.BlockArgs;

  // either we know the capabilities statically or we need to be conservative and assume
  // that the component requires all capabilities
  capabilities: CapabilityMask | true;

  // do we have the layout statically or will we need to look it up at runtime?
  layout?: CompilableProgram;
}

/**
 * A resolved component may be late-bound (which means that its component is not present at the time
 * that the component is compiled). If `component.layout` is `null`, then we use a special
 * compilation that doesn't attempt to use capabilities to specialize the opcodes, which  means that
 * late-bound components are always assumed to have all capabilities.
 */
export function InvokeResolvedComponent(
  encode: EncodeOp,
  component: CompileTimeComponent,
  args: WireFormat.Core.BlockArgs
): void {
  if (component.layout) {
    return InvokeStaticComponent(encode, args, component);
  }

  InvokeDynamicComponent(encode, args, component);
}

export function InvokeReplayableComponentExpression(
  encode: EncodeOp,
  definition: WireFormat.Core.Expression,
  args: WireFormat.Core.BlockArgs,
  options?: { curried?: boolean }
): void {
  Replayable(
    encode,

    () => {
      expr(encode, definition);
      encode.op(VM_DUP_SP_OP, 0);
      return 2;
    },

    () => {
      encode.op(VM_JUMP_UNLESS_OP, encode.to('ELSE'));

      if (options?.curried || !encode.isDynamicStringAllowed()) {
        encode.op(VM_RESOLVE_COMPONENT_DEFINITION);
      } else {
        encode.op(VM_RESOLVE_COMPONENT_DEFINITION_OR_STRING, 1);
      }

      InvokeDynamicComponent(encode, args);
      encode.mark('ELSE');
    }
  );
}

export function InvokeStaticComponent(
  encode: EncodeOp,
  args: WireFormat.Core.BlockArgs,
  component: EarlyBoundCompileTimeComponent
): void {
  const { capabilities, layout } = component;
  let { symbolTable } = layout;

  if (hasCapability(capabilities, InternalComponentCapabilities.prepareArgs)) {
    InvokeDynamicComponent(encode, args, component);
    return;
  }

  encode.op(VM_FETCH_OP, $s0);
  encode.op(VM_DUP_SP_OP, 1);
  encode.op(VM_LOAD_OP, $s0);
  encode.op(VM_PUSH_FRAME_OP);

  // Setup arguments
  let { symbols } = symbolTable;

  // As we push values onto the stack, we store the symbols associated  with them
  // so that we can set them on the scope later on with SetVariable and SetBlock
  let blockSymbols: number[] = [];
  let argSymbols: number[] = [];
  let argNames: string[] = [];

  const allBlocks = hasBlocks(args) ? getNamedBlocks(getBlocks(args)) : EMPTY_BLOCKS;
  const [splattributes, namedBlocks] = allBlocks.remove('attrs');

  // First we push the blocks onto the stack
  let blockNames = namedBlocks.names;

  // Starting with the attrs block, if it exists and is referenced in the component
  if (splattributes) {
    let symbol = symbols.indexOf(ATTRS_BLOCK);

    if (symbol !== -1) {
      PushYieldableBlock(encode, splattributes);
      blockSymbols.push(symbol);
    }
  }

  // Followed by the other blocks, if they exist and are referenced in the component.
  // Also store the index of the associated symbol.
  for (const name of blockNames) {
    let symbol = symbols.indexOf(`&${name}`);

    if (symbol !== -1) {
      PushYieldableBlock(encode, namedBlocks.get(name));
      blockSymbols.push(symbol);
    }
  }

  const named = hasNamed(args) ? getNamed(args) : undefined;
  const positional = hasPositional(args) ? getPositional(args) : undefined;

  // Next up we have arguments. If the component has the `createArgs` capability,
  // then it wants access to the arguments in JavaScript. We can't know whether
  // or not an argument is used, so we have to give access to all of them.
  if (hasCapability(capabilities, InternalComponentCapabilities.createArgs)) {
    // First we push positional arguments
    let count = CompilePositional(encode, positional);

    // setup the flags with the count of positionals, and to indicate that atNames
    // are used
    let flags = count << 4;
    flags |= 0b1000;

    let names: string[] = EMPTY_STRING_ARRAY;

    // Next, if named args exist, push them all. If they have an associated symbol
    // in the invoked component (e.g. they are used within its template), we push
    // that symbol. If not, we still push the expression as it may be used, and
    // we store the symbol as -1 (this is used later).
    if (named) {
      names = named[0];
      let val = named[1];

      for (let i = 0; i < val.length; i++) {
        let symbol = symbols.indexOf(unwrap(names[i]));

        const value = val[i];
        if (value === undefined) {
          throw new Error(`Missing value for named argument at index ${i}`);
        }
        expr(encode, value);
        argSymbols.push(symbol);
      }
    }

    // Finally, push the VM arguments themselves. These args won't need access
    // to blocks (they aren't accessible from userland anyways), so we push an
    // empty array instead of the actual block names.
    encode.op(VM_PUSH_ARGS_OP, encode.array(names), encode.array(EMPTY_STRING_ARRAY), flags);

    // And push an extra pop operation to remove the args before we begin setting
    // variables on the local context
    argSymbols.push(-1);
  } else if (named) {
    // If the component does not have the `createArgs` capability, then the only
    // expressions we need to push onto the stack are those that are actually
    // referenced in the template of the invoked component (e.g. have symbols).
    let names = named[0];
    let val = named[1];

    for (let i = 0; i < val.length; i++) {
      let name = unwrap(names[i]);
      let symbol = symbols.indexOf(name);

      if (symbol !== -1) {
        const value = val[i];
        if (value === undefined) {
          throw new Error(`Missing value for named argument at index ${i}`);
        }
        expr(encode, value);
        argSymbols.push(symbol);
        argNames.push(name);
      }
    }
  }

  encode.op(VM_BEGIN_COMPONENT_TRANSACTION_OP, $s0);

  if (hasCapability(capabilities, InternalComponentCapabilities.dynamicScope)) {
    encode.op(VM_PUSH_AND_BIND_DYNAMIC_SCOPE_OP);
  }

  if (hasCapability(capabilities, InternalComponentCapabilities.createInstance)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    encode.op(VM_CREATE_COMPONENT_OP, (namedBlocks.has('default') as any) | 0);
  }

  encode.op(VM_REGISTER_COMPONENT_DESTRUCTOR_OP, $s0);

  if (hasCapability(capabilities, InternalComponentCapabilities.createArgs)) {
    encode.op(VM_GET_COMPONENT_SELF_OP, $s0);
  } else {
    encode.op(VM_GET_COMPONENT_SELF_OP, $s0, encode.array(argNames));
  }

  // Setup the new root scope for the component
  encode.op(VM_ROOT_SCOPE_OP, symbols.length + 1, Object.keys(namedBlocks).length > 0 ? 1 : 0);

  // Pop the self reference off the stack and set it to the symbol for `this`
  // in the new scope. This is why all subsequent symbols are increased by one.
  encode.op(VM_SET_VARIABLE_OP, 0);

  // Going in reverse, now we pop the args/blocks off the stack, starting with
  // arguments, and assign them to their symbols in the new scope.
  for (const symbol of reverse(argSymbols)) {
    if (symbol === -1) {
      // The expression was not bound to a local symbol, it was only pushed to be
      // used with VM args in the javascript side
      encode.op(VM_POP_OP, 1);
    } else {
      encode.op(VM_SET_VARIABLE_OP, symbol + 1);
    }
  }

  // if any positional params exist, pop them off the stack as well
  if (positional) {
    encode.op(VM_POP_OP, positional.length);
  }

  // Finish up by popping off and assigning blocks
  for (const symbol of reverse(blockSymbols)) {
    encode.op(VM_SET_BLOCK_OP, symbol + 1);
  }

  encode.op(VM_JIT_INVOKE_VIRTUAL_OP, encode.constant(layout));

  encode.op(VM_DID_RENDER_LAYOUT_OP, $s0);

  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_POP_SCOPE_OP);

  if (hasCapability(capabilities, InternalComponentCapabilities.dynamicScope)) {
    encode.op(VM_POP_DYNAMIC_SCOPE_OP);
  }

  encode.op(VM_COMMIT_COMPONENT_TRANSACTION_OP);
  encode.op(VM_LOAD_OP, $s0);
}

export function InvokeDynamicComponent(
  encode: EncodeOp,
  args: WireFormat.Core.BlockArgs,
  component?: CompileTimeComponent
): void {
  let bindableAtNames =
    !component ||
    hasCapability(component.capabilities, InternalComponentCapabilities.prepareArgs) ||
    hasNamed(args);

  encode.op(VM_FETCH_OP, $s0);
  encode.op(VM_DUP_SP_OP, 1);
  encode.op(VM_LOAD_OP, $s0);

  encode.op(VM_PUSH_FRAME_OP);

  CompileArgs(encode, args);
  encode.op(VM_PREPARE_ARGS_OP, $s0);

  const layout = component?.layout;

  invokePreparedComponent(
    encode,
    hasBlocks(args) && getBlocks(args)[0].includes('default'),
    hasBlocks(args),
    bindableAtNames,
    () => {
      if (layout) {
        encode.op(VM_PUSH_SYMBOL_TABLE_OP, encode.constant(layout.symbolTable));
        encode.op(VM_CONSTANT_OP, encode.constant(layout));
        encode.op(VM_COMPILE_BLOCK_OP);
      } else {
        encode.op(VM_GET_COMPONENT_LAYOUT_OP, $s0);
      }

      encode.op(VM_POPULATE_LAYOUT_OP, $s0);
    }
  );

  encode.op(VM_LOAD_OP, $s0);
}

export function WrappedComponent(
  encode: EncodeOp,
  layout: LayoutWithContext,
  attrsBlockNumber: number
): void {
  encode.startLabels();
  WithSavedRegister(encode, $s1, () => {
    encode.op(VM_GET_COMPONENT_TAG_NAME_OP, $s0);
    encode.op(VM_PRIMITIVE_REFERENCE_OP);
    encode.op(VM_DUP_SP_OP, 0);
  });
  encode.op(VM_JUMP_UNLESS_OP, encode.to('BODY'));
  encode.op(VM_FETCH_OP, $s1);
  encode.op(VM_PUT_COMPONENT_OPERATIONS_OP);
  encode.op(VM_OPEN_DYNAMIC_ELEMENT_OP);
  encode.op(VM_DID_CREATE_ELEMENT_OP, $s0);
  encode.op(VM_PUSH_EMPTY_ARGS_OP);
  YieldBlock(encode, attrsBlockNumber);
  encode.op(VM_FLUSH_ELEMENT_OP);
  encode.mark('BODY');
  InvokeStaticBlock(encode, [layout.block[0], []]);
  encode.op(VM_FETCH_OP, $s1);
  encode.op(VM_JUMP_UNLESS_OP, encode.to('END'));
  encode.op(VM_CLOSE_ELEMENT_OP);
  encode.mark('END');
  encode.op(VM_LOAD_OP, $s1);
  encode.stopLabels();
}

export function invokePreparedComponent(
  encode: EncodeOp,
  hasBlock: boolean,
  bindableBlocks: boolean,
  bindableAtNames: boolean,
  populateLayout: Nullable<() => void> = null
): void {
  encode.op(VM_BEGIN_COMPONENT_TRANSACTION_OP, $s0);
  encode.op(VM_PUSH_AND_BIND_DYNAMIC_SCOPE_OP);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encode.op(VM_CREATE_COMPONENT_OP, (hasBlock as any) | 0);

  // this has to run after createComponent to allow
  // for late-bound layouts, but a caller is free
  // to populate the layout earlier if it wants to
  // and do nothing here.
  if (populateLayout) {
    populateLayout();
  }

  encode.op(VM_REGISTER_COMPONENT_DESTRUCTOR_OP, $s0);
  encode.op(VM_GET_COMPONENT_SELF_OP, $s0);

  encode.op(VM_VIRTUAL_ROOT_SCOPE_OP, $s0);
  encode.op(VM_SET_VARIABLE_OP, 0);

  if (bindableAtNames) encode.op(VM_SET_NAMED_VARIABLES_OP, $s0);
  if (bindableBlocks) encode.op(VM_SET_BLOCKS_OP, $s0);

  encode.op(VM_POP_OP, 1);
  encode.op(VM_INVOKE_COMPONENT_LAYOUT_OP, $s0);
  encode.op(VM_DID_RENDER_LAYOUT_OP, $s0);
  encode.op(VM_POP_FRAME_OP);

  encode.op(VM_POP_SCOPE_OP);
  encode.op(VM_POP_DYNAMIC_SCOPE_OP);
  encode.op(VM_COMMIT_COMPONENT_TRANSACTION_OP);
}

export function InvokeBareComponent(encode: EncodeOp): void {
  encode.op(VM_FETCH_OP, $s0);
  encode.op(VM_DUP_SP_OP, 1);
  encode.op(VM_LOAD_OP, $s0);

  encode.op(VM_PUSH_FRAME_OP);
  encode.op(VM_PUSH_EMPTY_ARGS_OP);
  encode.op(VM_PREPARE_ARGS_OP, $s0);
  invokePreparedComponent(encode, false, false, true, () => {
    encode.op(VM_GET_COMPONENT_LAYOUT_OP, $s0);
    encode.op(VM_POPULATE_LAYOUT_OP, $s0);
  });
  encode.op(VM_LOAD_OP, $s0);
}

export function WithSavedRegister(
  encode: EncodeOp,
  register: SavedRegister,
  block: () => void
): void {
  encode.op(VM_FETCH_OP, register);
  block();
  encode.op(VM_LOAD_OP, register);
}
