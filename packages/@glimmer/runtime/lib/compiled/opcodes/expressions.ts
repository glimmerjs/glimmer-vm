import type {
  CapturedPositionalArguments,
  CurriedType,
  Helper,
  HelperDefinitionState,
  Initializable,
  ScopeBlock,
  UpdatingOpcode,
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
  VM_HELPER_FRAME_OP,
  VM_HELPER_OP,
  VM_IF_INLINE_OP,
  VM_LOG_OP,
  VM_NOT_OP,
  VM_PUSH_HELPER_OP,
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
import { isCurriedType, resolveCurriedValue } from '@glimmer/program';
import {
  childRefFor,
  createComputeRef,
  FALSE_REFERENCE,
  isConstRef,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  valueForRef,
} from '@glimmer/reference';
import { assign, isIndexable } from '@glimmer/util';

import { APPEND_OPCODES } from '../../opcodes';
import createCurryRef from '../../references/curry-value';
import { createConcatRef } from '../expressions/concat';
import {
  CheckArguments,
  CheckCompilableBlock,
  CheckHelper,
  CheckReference,
  CheckScope,
  CheckScopeBlock,
  CheckUndefinedReference,
} from './-debug-strip';

APPEND_OPCODES.add(VM_CURRY_OP, (vm, { op1: type, op2: _isStringAllowed }) => {
  let stack = vm.stack;

  let args = check(stack.pop(), CheckArguments);
  let definition = check(stack.get(-1), CheckReference);

  let capturedArgs = args.capture();

  let owner = vm.getOwner();
  let resolver = vm.context.resolver;

  let isStringAllowed = false;

  if (import.meta.env.DEV) {
    // strict check only happens in import.meta.env.DEV builds, no reason to load it otherwise
    isStringAllowed = vm.constants.getValue<boolean>(decodeHandle(_isStringAllowed));
  }

  vm.lowlevel.setReturnValue(
    createCurryRef(type as CurriedType, definition, owner, capturedArgs, resolver, isStringAllowed)
  );
});

APPEND_OPCODES.add(VM_DYNAMIC_HELPER_OP, (vm) => {
  let stack = vm.stack;
  let args = check(stack.pop(), CheckArguments);
  // Get the helper ref from $fp - 1 (the reserved slot)
  let ref = check(stack.get(-1), CheckReference);

  let capturedArgs = args.capture();

  let helperRef: Initializable<Reference> | undefined;
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
        capturedArgs.positional = positional.concat(
          capturedArgs.positional
        ) as CapturedPositionalArguments;
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

    // Return the ref itself, not its value
    return helperRef;
  });

  let helperValueRef = createComputeRef(() => {
    let ref = valueForRef(helperInstanceRef) as Reference | undefined;
    let result = ref ? valueForRef(ref) : undefined;
    return result;
  });

  vm.associateDestroyable(helperInstanceRef);
  vm.lowlevel.setReturnValue(helperValueRef);
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
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());

  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }

  vm.lowlevel.setReturnValue(value);
});

APPEND_OPCODES.add(VM_HELPER_FRAME_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());

  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }

  // Use setReturnValue to write to the position at $fp - 1
  // This overwrites the helper ref with the result
  vm.lowlevel.setReturnValue(value);
});

APPEND_OPCODES.add(VM_PUSH_HELPER_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());

  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }

  // KEY DIFFERENCE: Push to stack instead of storing in $v0
  // Helper returns a Reference, so we can push it directly
  stack.push(value);
});

APPEND_OPCODES.add(VM_GET_VARIABLE_OP, (vm, { op1: symbol }) => {
  let expr = vm.referenceForSymbol(symbol);

  vm.stack.push(expr);
});

APPEND_OPCODES.add(VM_SET_VARIABLE_OP, (vm, { op1: symbol }) => {
  let expr = check(vm.stack.pop(), CheckReference);
  vm.scope().bindSymbol(symbol, expr);
});

APPEND_OPCODES.add(VM_SET_BLOCK_OP, (vm, { op1: symbol }) => {
  let handle = check(vm.stack.pop(), CheckCompilableBlock);
  let scope = check(vm.stack.pop(), CheckScope);
  let table = check(vm.stack.pop(), CheckBlockSymbolTable);

  vm.scope().bindBlock(symbol, [handle, scope, table]);
});

APPEND_OPCODES.add(VM_ROOT_SCOPE_OP, (vm, { op1: size }) => {
  vm.pushRootScope(size, vm.getOwner());
});

APPEND_OPCODES.add(VM_GET_PROPERTY_OP, (vm, { op1: _key }) => {
  let key = vm.constants.getValue<string>(_key);
  let expr = check(vm.stack.pop(), CheckReference);

  vm.stack.push(childRefFor(expr, key));
});

APPEND_OPCODES.add(VM_GET_BLOCK_OP, (vm, { op1: _block }) => {
  let { stack } = vm;
  let block = vm.scope().getBlock(_block);

  stack.push(block);
});

APPEND_OPCODES.add(VM_SPREAD_BLOCK_OP, (vm) => {
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
  let block = check(stack.pop(), CheckNullable(CheckOr(CheckScopeBlock, CheckUndefinedReference)));

  if (block && !isUndefinedReference(block)) {
    stack.push(TRUE_REFERENCE);
  } else {
    stack.push(FALSE_REFERENCE);
  }
});

APPEND_OPCODES.add(VM_HAS_BLOCK_PARAMS_OP, (vm) => {
  // FIXME(mmun): should only need to push the symbol table
  let _block = check(vm.stack.pop(), CheckMaybe(CheckOr(CheckHandle, CheckCompilableBlock)));
  let _scope = check(vm.stack.pop(), CheckMaybe(CheckScope));
  let table = check(vm.stack.pop(), CheckMaybe(CheckBlockSymbolTable));

  let hasBlockParams = table && table.parameters.length;
  vm.stack.push(hasBlockParams ? TRUE_REFERENCE : FALSE_REFERENCE);
});

APPEND_OPCODES.add(VM_CONCAT_OP, (vm, { op1: count }) => {
  let out = new Array<Reference>(count);

  for (let i = count; i > 0; i--) {
    let offset = i - 1;
    let ref = check(vm.stack.pop(), CheckReference);
    out[offset] = ref;
  }

  vm.stack.push(createConcatRef(out));
});

APPEND_OPCODES.add(VM_IF_INLINE_OP, (vm) => {
  let condition = check(vm.stack.pop(), CheckReference);
  let truthy = check(vm.stack.pop(), CheckReference);
  let falsy = check(vm.stack.pop(), CheckReference);

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
  let ref = check(vm.stack.pop(), CheckReference);

  vm.stack.push(
    createComputeRef(() => {
      return !toBool(valueForRef(ref));
    })
  );
});

APPEND_OPCODES.add(VM_GET_DYNAMIC_VAR_OP, (vm) => {
  let scope = vm.dynamicScope();
  let stack = vm.stack;
  let nameRef = check(stack.pop(), CheckReference);

  stack.push(
    createComputeRef(() => {
      let name = String(valueForRef(nameRef));
      return valueForRef(scope.get(name));
    })
  );
});

class LogOpcode implements UpdatingOpcode {
  constructor(private refs: Reference[]) {
    // Log immediately on creation
    this.evaluate();
  }

  evaluate(): void {
    const values = this.refs.map((ref) => valueForRef(ref));
    // eslint-disable-next-line no-console
    console.log(...values);
  }
}

APPEND_OPCODES.add(VM_LOG_OP, (vm, { op1: arity }) => {
  // Pop arity values from the stack in reverse order
  const refs: Reference[] = [];
  for (let i = 0; i < arity; i++) {
    refs.unshift(check(vm.stack.pop(), CheckReference));
  }

  // Create an updating opcode that will log on each re-render
  const hasNonConstRefs = refs.some((ref) => !isConstRef(ref));
  if (hasNonConstRefs) {
    vm.updateWith(new LogOpcode(refs));
  } else {
    // If all refs are constant, just log once
    const values = refs.map((ref) => valueForRef(ref));
    // eslint-disable-next-line no-console
    console.log(...values);
  }

  // Log returns undefined
  vm.stack.push(UNDEFINED_REFERENCE);
});
