import type { Primitive } from '../../stack-check';
import { decodeHandle, decodeImmediate, isHandle } from '@glimmer/util';
import {
  $s0,
  $fp,
  $s1,
  $t0,
  $t1,
  $v0,
  $sp,
  CURRIED_COMPONENT,
  CURRIED_HELPER,
  CURRIED_MODIFIER,
} from '@glimmer/vm';
import type { ComponentDefinition, Nullable } from '@glimmer/interfaces';
import { MISMATCH, ok } from './shared';
import type { AnyFunction } from './shared';
import { define, nullable } from './define-operand';

export const ImmU32 = define('unsigned', (value) => {
  return value;
});

// The program counter relative to the start of the current
// intstruction.
export const ImmRelativeInstruction = define('instruction/relative', (value, vm) =>
  vm.target(value)
);

// An absolute instruction.
export const ImmInstruction = define('instruction', (value) => value);

export const BlockHandle = define('handle/block', (handle, debug) => debug.heap.getaddr(handle));

export const ConstAny = define('const/any', (value, vm) => vm.derefHandle<unknown>(value));

export const ConstI32Arr = define('const/number[]', (value, { constants }) =>
  constants.getArray<number[]>(value)
);

export const ConstAnyArr = define('const/any[]', (handle, vm) =>
  vm.derefArrayHandle<unknown[]>(handle)
);

export const ConstStrArr = define('const/string[]', (handle, vm) =>
  vm.derefArrayHandle<string[]>(handle)
);

export const ConstNullableStrArr = nullable(ConstStrArr);

export const ConstComponentDefinition = define('const/definition<component>', (handle, vm) =>
  vm.derefHandle<ComponentDefinition>(handle)
);

export const EncodedPrimitive = define('primitive', (encoded, { constants }) => {
  if (isHandle(encoded)) {
    return constants.getValue(decodeHandle(encoded));
  } else {
    return decodeImmediate(encoded);
  }
});

export const Variable = define('variable', (symbol, debug) => {
  const symbols = debug.symbols;

  // the 0th symbol is always 'this', so it's not included in debug symbols
  const offset = symbol - 1;
  return { name: symbols[offset] ?? null, symbol };
});

export const CopyingVariable = define('variable/copying', (symbol) => symbol);

export const ArgFlags = define('flags/args', (flags) => {
  const positionalCount = flags >> 4;
  const atNames = flags & 0b1000;
  const hasBlocks = flags & 0b0111;

  return {
    positional: positionalCount,
    hasAtNames: !!atNames,
    hasBlocks: !!hasBlocks,
  };
});

export const StackRegister = define.fallible(
  'register/sp',
  `a stack register ($sp or $fp)`,
  (register, vm) => {
    switch (register) {
      case $sp:
        return ok(vm.sp);
      case $fp:
        return ok(vm.fp);
      default:
        return MISMATCH;
    }
  }
);

export const SavedRegister = define.fallible(
  'register/saved',
  `a saved register ($s0 or $s1)`,
  (register, vm) => {
    switch (register) {
      case $s0:
        return ok(['s0', vm.registers.saved.$s0]);
      case $s1:
        return ok(['s1', vm.registers.saved.$s1]);
      default:
        return MISMATCH;
    }
  }
);

export const SyscallRegister = define.fallible(
  'register/syscall',
  `a syscall register ($s0, $s1, $t0, $t1, or $v0)`,
  (register, vm) => {
    switch (register) {
      case $s0:
        return ok(['s0', vm.registers.saved.$s0]);
      case $s1:
        return ok(['s1', vm.registers.saved.$s1]);
      case $t0:
        return ok(['t0', vm.registers.temporaries.$t0]);
      case $t1:
        return ok(['t1', vm.registers.temporaries.$t1]);
      case $v0:
        return ok(['v0', vm.registers.return]);
      default:
        return MISMATCH;
    }
  }
);

export const ConstBool = define('const/boolean', (handle, vm) => vm.derefHandle<boolean>(handle));

export const ConstString = define('const/string', (handle, vm) => vm.derefHandle<string>(handle));
export const ConstNullableString = nullable(ConstString);

export const HelperHandle = define('const/function', (handle, vm) => {
  // @premerge should this be decodeHandle? It's not what happens at runtime,
  // but that's probably just because decodeHandle doesn't do anything other
  // than debug-time verification so it wouldn't have been missed?
  return vm.constants.getValue<AnyFunction>(handle);
});

export const CurryType = define.fallible('enum<curry>', 'a curry type (0, 1 or 2)', (value) => {
  switch (value) {
    case CURRIED_COMPONENT:
      return ok('component');
    case CURRIED_HELPER:
      return ok('helper');
    case CURRIED_MODIFIER:
      return ok('modifier');
    default:
      return MISMATCH;
  }
});

export type OperandSpec =
  | readonly ['const/any[]', unknown[]]
  | readonly ['const/number[]', number[]]
  | readonly ['const/string[]', string[]]
  | readonly ['const/string[]?', Nullable<string[]>]
  | readonly ['const/boolean', boolean]
  | readonly ['const/string', string]
  | readonly ['const/string?', Nullable<string>]
  | readonly ['const/function', AnyFunction]
  | readonly ['const/any', unknown]
  // if the name is null, it's unknown for some reason.
  | readonly ['variable', { name: Nullable<string>; symbol: number }]
  | readonly ['variable/block', { name: Nullable<string>; symbol: number }]
  // @todo symbols are copied before their block is processed, so we don't have
  // the block's containing meta yet.
  | readonly ['variable/copying', number]
  | readonly ['const/definition<component>', ComponentDefinition]
  | readonly ['primitive', Primitive]
  | readonly ['handle/block', number]
  | readonly ['instruction', number]
  | readonly ['instruction/relative', number]
  | readonly [`register/syscall`, readonly ['s0' | 's1' | 't0' | 't1' | 'v0', unknown]]
  | readonly [`register/saved`, readonly ['s0' | 's1', unknown]]
  | readonly ['register/temporary', readonly ['t0' | 't1', unknown]]
  | readonly ['register/v0', unknown]
  | readonly ['register/sp', number]
  | readonly ['enum<curry>', 'component' | 'helper' | 'modifier']
  | readonly ['register/fp', number]
  | readonly ['flags/args', { positional: number; hasAtNames: boolean; hasBlocks: boolean }]
  | readonly ['signed', number]
  | readonly ['unsigned', number]
  | readonly ['error', { expected: string; got: number }];

export type OperandSpecName = OperandSpec[0];
export type OperandSpecValue = OperandSpec[1];
