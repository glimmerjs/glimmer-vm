import type {
  CapturedPositionalArguments,
  CurriedType,
  Helper,
  HelperDefinitionState,
  Initializable,
  ScopeBlock,
} from '@glimmer/interfaces';
import type { Reference } from '@glimmer/reference';
import {
  CURRIED_HELPER,
  decodeHandle,
  VM_CONCAT_OP,
  VM_CURRY_OP,
  VM_DYNAMIC_HELPER_OP,
  VM_GET_BLOCK_OP,
  VM_GET_DYNAMIC_VAR_OP,
  VM_GET_PROPERTY_OP,
  VM_GET_VARIABLE_OP,
  VM_HAS_BLOCK_OP,
  VM_HAS_BLOCK_PARAMS_OP,
  VM_HELPER_OP,
  VM_IF_INLINE_OP,
  VM_LOG_OP,
  VM_NOT_OP,
  VM_ROOT_SCOPE_OP,
  VM_SET_BLOCK_OP,
  VM_SET_VARIABLE_OP,
  VM_SPREAD_BLOCK_OP,
} from '@glimmer/constants';
import {
  check,
  CheckBlockSymbolTable,
  CheckHandle,
  CheckMaybe,
  CheckNullable,
  CheckOr,
} from '@glimmer/debug';
import { debugToString, localAssert } from '@glimmer/debug-util';
import { _hasDestroyableChildren, associateDestroyableChild, destroy } from '@glimmer/destroyable';
import { debugAssert, toBool } from '@glimmer/global-context';
import { getInternalHelperManager } from '@glimmer/manager';
import { isCurriedType, resolveCurriedValue } from "@glimmer/program/lib/util/curried-value";
import {
  childRefFor,
  createComputeRef,
  FALSE_REFERENCE,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  valueForRef,
} from '@glimmer/reference';
import { assign, isIndexable } from '@glimmer/util';
import { $v0 } from '@glimmer/vm';

import { APPEND_OPCODES } from '../../opcodes';
import createCurryRef from '../../references/curry-value';
import { reifyPositional } from '../../vm/arguments';
import { createConcatRef } from '../expressions/concat';
import {
  CheckArguments,
  CheckCapturedArguments,
  CheckCompilableBlock,
  CheckHelper,
  CheckReference,
  CheckScope,
  CheckScopeBlock,
  CheckUndefinedReference,
} from './-debug-strip';

APPEND_OPCODES.add(VM_CURRY_OP, (vm, { op1: type, op2: _isStringAllowed }) => {
  let stack = vm.stack;

  let definition = stack.pop();
  let capturedArgs = stack.pop();

  if (import.meta.env.DEV) {
    check(definition, CheckReference);
    check(capturedArgs, CheckCapturedArguments);
  }

  let owner = vm.getOwner();
  let resolver = vm.context.resolver;

  let isStringAllowed = false;

  if (import.meta.env.DEV) {
    // strict check only happens in import.meta.env.DEV builds, no reason to load it otherwise
    isStringAllowed = vm.constants.getValue<boolean>(decodeHandle(_isStringAllowed));
  }

  vm.loadValue(
    $v0,
    createCurryRef(type as CurriedType, definition, owner, capturedArgs, resolver, isStringAllowed)
  );
});

APPEND_OPCODES.add(VM_DYNAMIC_HELPER_OP, (vm) => {
  let stack = vm.stack;
  let ref = stack.pop();
  let args = stack.pop();

  if (import.meta.env.DEV) {
    check(ref, CheckReference);
    check(args, CheckArguments);
  }

  let capturedArgs = args.capture();

  let helperRef: Initializable<Reference>;
  let initialOwner = vm.getOwner();

  let helperInstanceRef = createComputeRef(() => {
    if (helperRef !== undefined) {
      destroy(helperRef);
    }

    let definition = valueForRef(ref);

    if (isCurriedType(definition, CURRIED_HELPER)) {
      let { definition: resolvedDef, owner, positional, named } = resolveCurriedValue(definition);

      let helper = resolveHelper(resolvedDef, ref);

      if (named !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        capturedArgs.named = assign({}, ...named, capturedArgs.named);
      }

      if (positional !== undefined) {
        capturedArgs.positional = positional.concat(capturedArgs.positional) as CapturedPositionalArguments;
      }

      helperRef = helper(capturedArgs, owner);

      associateDestroyableChild(helperInstanceRef, helperRef);
    } else if (isIndexable(definition)) {
      let helper = resolveHelper(definition, ref);
      helperRef = helper(capturedArgs, initialOwner);

      if (_hasDestroyableChildren(helperRef)) {
        associateDestroyableChild(helperInstanceRef, helperRef);
      }
    } else {
      helperRef = UNDEFINED_REFERENCE;
    }
  });

  let helperValueRef = createComputeRef(() => {
    valueForRef(helperInstanceRef);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    return valueForRef(helperRef!);
  });

  vm.associateDestroyable(helperInstanceRef);
  vm.loadValue($v0, helperValueRef);
});

function resolveHelper(definition: HelperDefinitionState, ref: Reference): Helper {
  let managerOrHelper = getInternalHelperManager(definition, true);
  let helper;
  if (managerOrHelper === null) {
    helper = null;
  } else {
    helper =
      typeof managerOrHelper === 'function'
        ? managerOrHelper
        : managerOrHelper.getHelper(definition);
    if (import.meta.env.DEV) {
      localAssert(managerOrHelper, 'BUG: expected manager or helper');
    }
  }

  debugAssert(
    helper !== null,
    () =>
      `Expected a dynamic helper definition, but received an object or function that did not have a helper manager associated with it. The dynamic invocation was \`{{${
        ref.debugLabel
      }}}\` or \`(${ref.debugLabel})\`, and the incorrect definition is the value at the path \`${
        ref.debugLabel
      }\`, which was: ${debugToString?.(definition)}`
  );

  return helper;
}

APPEND_OPCODES.add(VM_HELPER_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = vm.constants.getValue(handle);
  let args = stack.pop();

  if (import.meta.env.DEV) {
    check(helper, CheckHelper);
    check(args, CheckArguments);
  }
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());

  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }

  vm.loadValue($v0, value);
});

APPEND_OPCODES.add(VM_GET_VARIABLE_OP, (vm, { op1: symbol }) => {
  let expr = vm.referenceForSymbol(symbol);

  vm.stack.push(expr);
});

APPEND_OPCODES.add(VM_SET_VARIABLE_OP, (vm, { op1: symbol }) => {
  let expr = vm.stack.pop();

  if (import.meta.env.DEV) {
    check(expr, CheckReference);
  }

  vm.scope().bindSymbol(symbol, expr);
});

APPEND_OPCODES.add(VM_SET_BLOCK_OP, (vm, { op1: symbol }) => {
  let handle = vm.stack.pop();
  let scope = vm.stack.pop();
  let table = vm.stack.pop();

  if (import.meta.env.DEV) {
    check(handle, CheckCompilableBlock);
    check(scope, CheckScope);
    check(table, CheckBlockSymbolTable);
  }

  vm.scope().bindBlock(symbol, [handle, scope, table]);
});

APPEND_OPCODES.add(VM_ROOT_SCOPE_OP, (vm, { op1: size }) => {
  vm.pushRootScope(size, vm.getOwner());
});

APPEND_OPCODES.add(VM_GET_PROPERTY_OP, (vm, { op1: _key }) => {
  let key = vm.constants.getValue<string>(_key);
  let expr = vm.stack.pop();

  if (import.meta.env.DEV) {
    check(expr, CheckReference);
  }

  vm.stack.push(childRefFor(expr, key));
});

APPEND_OPCODES.add(VM_GET_BLOCK_OP, (vm, { op1: _block }) => {
  let { stack } = vm;
  let block = vm.scope().getBlock(_block);

  stack.push(block);
});

APPEND_OPCODES.add(VM_SPREAD_BLOCK_OP, (vm) => {
  let { stack } = vm;
  let block = stack.pop();

  if (import.meta.env.DEV) {
    check(block, CheckNullable(CheckOr(CheckScopeBlock, CheckUndefinedReference)));
  }

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

function isUndefinedReference(input: ScopeBlock | Reference): input is Reference {
  if (import.meta.env.DEV) {
    localAssert(
    Array.isArray(input) || input === UNDEFINED_REFERENCE,
    'a reference other than UNDEFINED_REFERENCE is illegal here'
  );
  }
  return input === UNDEFINED_REFERENCE;
}

APPEND_OPCODES.add(VM_HAS_BLOCK_OP, (vm) => {
  let { stack } = vm;
  let block = stack.pop();

  if (import.meta.env.DEV) {
    check(block, CheckNullable(CheckOr(CheckScopeBlock, CheckUndefinedReference)));
  }

  if (block && !isUndefinedReference(block)) {
    stack.push(TRUE_REFERENCE);
  } else {
    stack.push(FALSE_REFERENCE);
  }
});

APPEND_OPCODES.add(VM_HAS_BLOCK_PARAMS_OP, (vm) => {
  // FIXME(mmun): should only need to push the symbol table
  let block = vm.stack.pop();
  let scope = vm.stack.pop();
  let table = vm.stack.pop();

  if (import.meta.env.DEV) {
    check(block, CheckMaybe(CheckOr(CheckHandle, CheckCompilableBlock)));
    check(scope, CheckMaybe(CheckScope));
    check(table, CheckMaybe(CheckBlockSymbolTable));
  }

  let hasBlockParams = table && table.parameters.length;
  vm.stack.push(hasBlockParams ? TRUE_REFERENCE : FALSE_REFERENCE);
});

APPEND_OPCODES.add(VM_CONCAT_OP, (vm, { op1: count }) => {
  let out = new Array<Reference>(count);

  for (let i = count; i > 0; i--) {
    let offset = i - 1;
    let ref = vm.stack.pop();

    if (import.meta.env.DEV) {
      check(ref, CheckReference);
    }

    out[offset] = ref;
  }

  vm.stack.push(createConcatRef(out));
});

APPEND_OPCODES.add(VM_IF_INLINE_OP, (vm) => {
  let condition = vm.stack.pop();
  let truthy = vm.stack.pop();
  let falsy = vm.stack.pop();

  if (import.meta.env.DEV) {
    check(condition, CheckReference);
    check(truthy, CheckReference);
    check(falsy, CheckReference);
  }

  vm.stack.push(
    createComputeRef(() => {
      if (toBool(valueForRef(condition))) {
        return valueForRef(truthy);
      } else {
        return valueForRef(falsy);
      }
    })
  );
});

APPEND_OPCODES.add(VM_NOT_OP, (vm) => {
  let ref = vm.stack.pop();

  if (import.meta.env.DEV) {
    check(ref, CheckReference);
  }

  vm.stack.push(
    createComputeRef(() => {
      return !toBool(valueForRef(ref));
    })
  );
});

APPEND_OPCODES.add(VM_GET_DYNAMIC_VAR_OP, (vm) => {
  let scope = vm.dynamicScope();
  let stack = vm.stack;
  let nameRef = stack.pop();

  if (import.meta.env.DEV) {
    check(nameRef, CheckReference);
  }

  stack.push(
    createComputeRef(() => {
      let name = String(valueForRef(nameRef));
      return valueForRef(scope.get(name));
    })
  );
});

APPEND_OPCODES.add(VM_LOG_OP, (vm) => {
  let args = vm.stack.pop();

  if (import.meta.env.DEV) {
    check(args, CheckArguments);
  }

  let { positional } = args.capture();

  vm.loadValue(
    $v0,
    createComputeRef(() => {
      // eslint-disable-next-line no-console
      console.log(...reifyPositional(positional));
    })
  );
});
