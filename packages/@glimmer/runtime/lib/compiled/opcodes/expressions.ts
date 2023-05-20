import {
  check,
  CheckBlockSymbolTable,
  CheckHandle,
  CheckMaybe,
  CheckOption,
  CheckOr,
} from '@glimmer/debug';
import { _hasDestroyableChildren, associateDestroyableChild, destroy } from '@glimmer/destroyable';
import { toBool } from '@glimmer/global-context';
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
import {
  childRefFor,
  createComputeRef,
  FALSE_REFERENCE,
  type Reference,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  valueForRef,
} from '@glimmer/reference';
import { assert, assign, debugToString, decodeHandle, isObject } from '@glimmer/util';
import {
  $v0,
  CONCAT_OP,
  CURRY_OP,
  DYNAMIC_HELPER_OP,
  GET_BLOCK_OP,
  GET_DYNAMIC_VAR_OP,
  GET_PROPERTY_OP,
  GET_VARIABLE_OP,
  HAS_BLOCK_OP,
  HAS_BLOCK_PARAMS_OP,
  HELPER_OP,
  IF_INLINE_OP,
  LOG_OP,
  NOT_OP,
  ROOT_SCOPE_OP,
  SET_BLOCK_OP,
  SET_VARIABLE_OP,
  SPREAD_BLOCK_OP,
  CURRIED_HELPER,
} from '@glimmer/vm-constants';

import { isCurriedType, resolveCurriedValue } from '../../curried-value';
import { define } from '../../opcodes';
import createCurryReference from '../../references/curry-value';
import { CONSTANTS } from '../../symbols';
import { reifyPositional } from '../../vm/arguments';
import { createConcatRef as createConcatReference } from '../expressions/concat';
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

export type FunctionExpression<T> = (vm: PublicVM) => Reference<T>;

define(CURRY_OP, (vm, { op1: type, op2: _isStrict }) => {
  let stack = vm.stack;

  let definition = check(stack.pop(), CheckReference);
  let capturedArgs = check(stack.pop(), CheckCapturedArguments);

  let owner = vm._getOwner_();
  let resolver = vm.runtime.resolver;

  let isStrict = false;

  if (import.meta.env.DEV) {
    // strict check only happens in import.meta.env.DEV builds, no reason to load it otherwise
    isStrict = vm[CONSTANTS].getValue<boolean>(decodeHandle(_isStrict));
  }

  vm._loadValue_(
    $v0,
    createCurryReference(type as CurriedType, definition, owner, capturedArgs, resolver, isStrict)
  );
});

define(DYNAMIC_HELPER_OP, (vm) => {
  let stack = vm.stack;
  let reference = check(stack.pop(), CheckReference);
  let args = check(stack.pop(), CheckArguments).capture();

  let helperReference: Reference;
  let initialOwner: Owner = vm._getOwner_();

  let helperInstanceReference = createComputeRef(() => {
    if (helperReference !== undefined) {
      destroy(helperReference);
    }

    let definition = valueForRef(reference);

    if (isCurriedType(definition, CURRIED_HELPER)) {
      let { definition: resolvedDef, owner, positional, named } = resolveCurriedValue(definition);

      let helper = resolveHelper(vm[CONSTANTS], resolvedDef, reference);

      if (named !== undefined) {
        args.named = assign({}, ...named, args.named);
      }

      if (positional !== undefined) {
        args.positional = [...positional, ...args.positional] as CapturedPositionalArguments;
      }

      helperReference = helper(args, owner);

      associateDestroyableChild(helperInstanceReference, helperReference);
    } else if (isObject(definition)) {
      let helper = resolveHelper(vm[CONSTANTS], definition, reference);
      helperReference = helper(args, initialOwner);

      if (_hasDestroyableChildren(helperReference)) {
        associateDestroyableChild(helperInstanceReference, helperReference);
      }
    } else {
      helperReference = UNDEFINED_REFERENCE;
    }
  });

  let helperValueReference = createComputeRef(() => {
    valueForRef(helperInstanceReference);
    return valueForRef(helperReference);
  });

  vm._associateDestroyable_(helperInstanceReference);
  vm._loadValue_($v0, helperValueReference);
});

function resolveHelper(
  constants: RuntimeConstants & ResolutionTimeConstants,
  definition: HelperDefinitionState,
  reference: Reference
): Helper {
  let handle = constants.helper(definition, null, true)!;

  if (import.meta.env.DEV && handle === null) {
    throw new Error(
      `Expected a dynamic helper definition, but received an object or function that did not have a helper manager associated with it. The dynamic invocation was \`{{${
        reference.debugLabel
      }}}\` or \`(${
        reference.debugLabel
      })\`, and the incorrect definition is the value at the path \`${
        reference.debugLabel
      }\`, which was: ${debugToString!(definition)}`
    );
  }

  return constants.getValue(handle);
}

define(HELPER_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm[CONSTANTS].getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm._getOwner_(), vm._dynamicScope_());

  if (_hasDestroyableChildren(value)) {
    vm._associateDestroyable_(value);
  }

  vm._loadValue_($v0, value);
});

define(GET_VARIABLE_OP, (vm, { op1: symbol }) => {
  let expr = vm._referenceForSymbol_(symbol);

  vm.stack.push(expr);
});

define(SET_VARIABLE_OP, (vm, { op1: symbol }) => {
  let expr = check(vm.stack.pop(), CheckReference);
  vm._scope_().bindSymbol(symbol, expr);
});

define(SET_BLOCK_OP, (vm, { op1: symbol }) => {
  let handle = check(vm.stack.pop(), CheckCompilableBlock);
  let scope = check(vm.stack.pop(), CheckScope);
  let table = check(vm.stack.pop(), CheckBlockSymbolTable);

  vm._scope_().bindBlock(symbol, [handle, scope, table]);
});

define(ROOT_SCOPE_OP, (vm, { op1: symbols }) => {
  vm._pushRootScope_(symbols, vm._getOwner_());
});

define(GET_PROPERTY_OP, (vm, { op1: _key }) => {
  let key = vm[CONSTANTS].getValue<string>(_key);
  let expr = check(vm.stack.pop(), CheckReference);
  vm.stack.push(childRefFor(expr, key));
});

define(GET_BLOCK_OP, (vm, { op1: _block }) => {
  let { stack } = vm;
  let block = vm._scope_().getBlock(_block);

  stack.push(block);
});

define(SPREAD_BLOCK_OP, (vm) => {
  let { stack } = vm;
  let block = check(stack.pop(), CheckOption(CheckOr(CheckScopeBlock, CheckUndefinedReference)));

  if (block && !isUndefinedReference(block)) {
    let [handleOrCompilable, scope, table] = block;

    stack.push(table, scope, handleOrCompilable);
  } else {
    stack.push(null, null, null);
  }
});

function isUndefinedReference(input: ScopeBlock | Reference): input is Reference {
  assert(
    Array.isArray(input) || input === UNDEFINED_REFERENCE,
    'a reference other than UNDEFINED_REFERENCE is illegal here'
  );
  return input === UNDEFINED_REFERENCE;
}

define(HAS_BLOCK_OP, (vm) => {
  let { stack } = vm;
  let block = check(stack.pop(), CheckOption(CheckOr(CheckScopeBlock, CheckUndefinedReference)));

  if (block && !isUndefinedReference(block)) {
    stack.push(TRUE_REFERENCE);
  } else {
    stack.push(FALSE_REFERENCE);
  }
});

define(HAS_BLOCK_PARAMS_OP, (vm) => {
  // FIXME(mmun): should only need to push the symbol table
  let block = vm.stack.pop();
  let scope = vm.stack.pop();

  check(block, CheckMaybe(CheckOr(CheckHandle, CheckCompilableBlock)));
  check(scope, CheckMaybe(CheckScope));
  let table = check(vm.stack.pop(), CheckMaybe(CheckBlockSymbolTable));

  let hasBlockParameters = table && table.parameters.length > 0;
  vm.stack.push(hasBlockParameters ? TRUE_REFERENCE : FALSE_REFERENCE);
});

define(CONCAT_OP, (vm, { op1: count }) => {
  let out: Array<Reference<unknown>> = Array.from({ length: count });

  for (let index = count; index > 0; index--) {
    let offset = index - 1;
    out[offset] = check(vm.stack.pop(), CheckReference);
  }

  vm.stack.push(createConcatReference(out));
});

define(IF_INLINE_OP, (vm) => {
  let condition = check(vm.stack.pop(), CheckReference);
  let truthy = check(vm.stack.pop(), CheckReference);
  let falsy = check(vm.stack.pop(), CheckReference);

  vm.stack.push(
    createComputeRef(() => {
      return toBool(valueForRef(condition)) === true ? valueForRef(truthy) : valueForRef(falsy);
    })
  );
});

define(NOT_OP, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  vm.stack.push(
    createComputeRef(() => {
      return !toBool(valueForRef(reference));
    })
  );
});

define(GET_DYNAMIC_VAR_OP, (vm) => {
  let scope = vm._dynamicScope_();
  let stack = vm.stack;
  let nameReference = check(stack.pop(), CheckReference);

  stack.push(
    createComputeRef(() => {
      let name = String(valueForRef(nameReference));
      return valueForRef(scope.get(name));
    })
  );
});

define(LOG_OP, (vm) => {
  let { positional } = check(vm.stack.pop(), CheckArguments).capture();

  vm._loadValue_(
    $v0,
    createComputeRef(() => {
      // eslint-disable-next-line no-console
      console.log(...reifyPositional(positional));
    })
  );
});
