import type {
  CapturedPositionalArguments,
  CurriedType,
  Helper,
  HelperDefinitionState,
  Owner,
  ResolutionTimeConstants,
  RuntimeConstants,
  ScopeBlock,
  VM as PublicVM,
} from '@glimmer/interfaces';
import type { Reactive } from '@glimmer/reference';
import {
  check,
  CheckBlockSymbolTable,
  CheckHandle,
  CheckMaybe,
  CheckNullable,
  CheckOr,
} from '@glimmer/debug';
import { _hasDestroyableChildren, associateDestroyableChild, destroy } from '@glimmer/destroyable';
import { toBool } from '@glimmer/global-context';
import {
  FALSE_REFERENCE,
  Formula,
  getReactiveProperty,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  unwrapReactive,
} from '@glimmer/reference';
import {
  assert,
  assign,
  debugToString,
  decodeHandle,
  isObject,
  stringifyDebugLabel,
} from '@glimmer/util';
import { $v0, CurriedTypes, Op } from '@glimmer/vm';

import { isCurried, resolveCurriedValue } from '../../curried-value';
import { APPEND_OPCODES } from '../../opcodes';
import createCurryRef from '../../references/curry-value';
import { reifyPositional } from '../../vm/arguments';
import { createConcatRef } from '../expressions/concat';
import {
  CheckArguments,
  CheckCapturedArguments,
  CheckCompilableBlock,
  CheckHelper,
  CheckReactive,
  CheckScope,
  CheckScopeBlock,
  CheckUndefinedReference,
} from './-debug-strip';

export type FunctionExpression<T> = (vm: PublicVM) => Reactive<T>;

APPEND_OPCODES.add(Op.Curry, (vm, { op1: type, op2: _isStrict }) => {
  let stack = vm.stack;

  let definition = check(stack.pop(), CheckReactive);
  let capturedArgs = check(stack.pop(), CheckCapturedArguments);

  let owner = vm.getOwner();
  let resolver = vm.runtime.resolver;

  let isStrict = false;

  if (import.meta.env.DEV) {
    // strict check only happens in import.meta.env.DEV builds, no reason to load it otherwise
    isStrict = vm.constants.getValue<boolean>(decodeHandle(_isStrict));
  }

  vm.loadValue(
    $v0,
    createCurryRef(type as CurriedType, definition, owner, capturedArgs, resolver, isStrict)
  );
});

APPEND_OPCODES.add(Op.DynamicHelper, (vm) => {
  let stack = vm.stack;
  let ref = check(stack.pop(), CheckReactive);
  let args = check(stack.pop(), CheckArguments).capture();

  let helperRef: Reactive;
  let initialOwner: Owner = vm.getOwner();

  let helperInstanceRef = Formula(() => {
    if (helperRef !== undefined) {
      destroy(helperRef);
    }

    let definition = unwrapReactive(ref);

    if (isCurried(definition, CurriedTypes.Helper)) {
      let { definition: resolvedDef, owner, positional, named } = resolveCurriedValue(definition);

      let helper = resolveHelper(vm.constants, resolvedDef, ref);

      if (named !== undefined) {
        args.named = assign({}, ...named, args.named);
      }

      if (positional !== undefined) {
        args.positional = positional.concat(args.positional) as CapturedPositionalArguments;
      }

      helperRef = helper(args, owner);

      associateDestroyableChild(helperInstanceRef, helperRef);
    } else if (isObject(definition)) {
      let helper = resolveHelper(vm.constants, definition, ref);
      helperRef = helper(args, initialOwner);

      if (_hasDestroyableChildren(helperRef)) {
        associateDestroyableChild(helperInstanceRef, helperRef);
      }
    } else {
      helperRef = UNDEFINED_REFERENCE;
    }
  });

  let helperValueRef = Formula(() => {
    unwrapReactive(helperInstanceRef);
  });

  vm.associateDestroyable(helperInstanceRef);
  vm.loadValue($v0, helperValueRef);
});

function resolveHelper(
  constants: RuntimeConstants & ResolutionTimeConstants,
  definition: HelperDefinitionState,
  ref: Reactive
): Helper {
  let handle = constants.helper(definition, null, true)!;

  if (import.meta.env.DEV && handle === null) {
    const label = stringifyDebugLabel(ref);

    throw new Error(
      `Expected a dynamic helper definition, but received an object or function that did not have a helper manager associated with it. The dynamic invocation was \`{{${String(
        label
      )}}}\` or \`(${label})\`, and the incorrect definition is the value at the path \`${label}\`, which was: ${debugToString!(
        definition
      )}`
    );
  }

  return constants.getValue(handle);
}

APPEND_OPCODES.add(Op.Helper, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);

  // @premerge throws but isn't a deref
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope);

  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }

  vm.loadValue($v0, value);
});

APPEND_OPCODES.add(Op.GetVariable, (vm, { op1: symbol }) => {
  let expr = vm.referenceForSymbol(symbol);

  vm.stack.push(expr);
});

APPEND_OPCODES.add(Op.SetVariable, (vm, { op1: symbol }) => {
  let expr = check(vm.stack.pop(), CheckReactive);
  vm.scope.bindSymbol(symbol, expr);
});

APPEND_OPCODES.add(Op.SetBlock, (vm, { op1: symbol }) => {
  let handle = check(vm.stack.pop(), CheckCompilableBlock);
  let scope = check(vm.stack.pop(), CheckScope);
  let table = check(vm.stack.pop(), CheckBlockSymbolTable);

  vm.scope.bindBlock(symbol, [handle, scope, table]);
});

APPEND_OPCODES.add(Op.RootScope, (vm, { op1: symbols }) => {
  vm.pushRootScope(symbols, vm.getOwner());
});

APPEND_OPCODES.add(Op.GetProperty, (vm, { op1: _key }) => {
  let key = vm.constants.getValue<string>(_key);
  let expr = check(vm.stack.pop(), CheckReactive);
  vm.stack.push(getReactiveProperty(expr, key));
});

APPEND_OPCODES.add(Op.GetBlock, (vm, { op1: _block }) => {
  let { stack } = vm;
  let block = vm.scope.getBlock(_block);

  stack.push(block);
});

APPEND_OPCODES.add(Op.SpreadBlock, (vm) => {
  let { stack } = vm;
  let block = check(stack.pop(), CheckNullable(CheckOr(CheckScopeBlock, CheckUndefinedReference)));

  if (block && !isUndefinedReference(block)) {
    let [handleOrCompilable, scope, table] = block;

    stack.push(table);
    stack.push(scope);
    stack.push(handleOrCompilable);
  } else {
    stack.push(null);
    stack.push(null);
    stack.push(null);
  }
});

function isUndefinedReference(input: ScopeBlock | Reactive): input is Reactive {
  assert(
    Array.isArray(input) || input === UNDEFINED_REFERENCE,
    'a reference other than UNDEFINED_REFERENCE is illegal here'
  );
  return input === UNDEFINED_REFERENCE;
}

APPEND_OPCODES.add(Op.HasBlock, (vm) => {
  let { stack } = vm;
  let block = check(stack.pop(), CheckNullable(CheckOr(CheckScopeBlock, CheckUndefinedReference)));

  if (block && !isUndefinedReference(block)) {
    stack.push(TRUE_REFERENCE);
  } else {
    stack.push(FALSE_REFERENCE);
  }
});

APPEND_OPCODES.add(Op.HasBlockParams, (vm) => {
  // FIXME(mmun): should only need to push the symbol table
  let block = vm.stack.pop();
  let scope = vm.stack.pop();

  check(block, CheckMaybe(CheckOr(CheckHandle, CheckCompilableBlock)));
  check(scope, CheckMaybe(CheckScope));
  let table = check(vm.stack.pop(), CheckMaybe(CheckBlockSymbolTable));

  let hasBlockParams = table && table.parameters.length;
  vm.stack.push(hasBlockParams ? TRUE_REFERENCE : FALSE_REFERENCE);
});

APPEND_OPCODES.add(Op.Concat, (vm, { op1: count }) => {
  let out: Array<Reactive<unknown>> = new Array(count);

  for (let i = count; i > 0; i--) {
    let offset = i - 1;
    out[offset] = check(vm.stack.pop(), CheckReactive);
  }

  vm.stack.push(createConcatRef(out));
});

APPEND_OPCODES.add(Op.IfInline, (vm) => {
  let condition = check(vm.stack.pop(), CheckReactive);
  let truthy = check(vm.stack.pop(), CheckReactive);
  let falsy = check(vm.stack.pop(), CheckReactive);

  vm.stack.push(
    Formula(() => {
      if (toBool(unwrapReactive(condition)) === true) {
        return unwrapReactive(truthy);
      } else {
        return unwrapReactive(falsy);
      }
    })
  );
});

APPEND_OPCODES.add(Op.Not, (vm) => {
  let ref = check(vm.stack.pop(), CheckReactive);

  vm.stack.push(
    Formula(() => {
      return !toBool(unwrapReactive(ref));
    })
  );
});

APPEND_OPCODES.add(Op.GetDynamicVar, (vm) => {
  let scope = vm.dynamicScope;
  let stack = vm.stack;
  let nameRef = check(stack.pop(), CheckReactive);

  stack.push(
    Formula(() => {
      let name = String(unwrapReactive(nameRef));
      return unwrapReactive(scope.get(name));
    })
  );
});

APPEND_OPCODES.add(Op.Log, (vm) => {
  let { positional } = check(vm.stack.pop(), CheckArguments).capture();

  vm.loadValue(
    $v0,
    Formula(() => {
      // eslint-disable-next-line no-console
      console.log(...reifyPositional(positional));
    })
  );
});
