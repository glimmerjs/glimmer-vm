import {
  CapturedPositionalArguments,
  CurriedType,
  Helper,
  HelperDefinitionState,
  Op,
  Owner,
  ResolutionTimeConstants,
  RuntimeConstants,
  ScopeBlock,
  VM as PublicVM,
  Source,
} from '@glimmer/interfaces';
import { pathSourceFor, UNDEFINED_SOURCE, TRUE_SOURCE, FALSE_SOURCE } from '@glimmer/reference';
import { createCache, getDebugLabel, getValue } from '@glimmer/validator';
import { $v0 } from '@glimmer/vm';
import { APPEND_OPCODES } from '../../opcodes';
import { createConcatSource } from '../expressions/concat';
import { associateDestroyableChild, destroy, _hasDestroyableChildren } from '@glimmer/destroyable';
import { assert, assign, debugToString, decodeHandle, isObject } from '@glimmer/util';
import { toBool } from '@glimmer/global-context';
import {
  check,
  CheckOption,
  CheckHandle,
  CheckBlockSymbolTable,
  CheckOr,
  CheckMaybe,
} from '@glimmer/debug';
import {
  CheckArguments,
  CheckSource,
  CheckCompilableBlock,
  CheckScope,
  CheckHelper,
  CheckUndefinedSource,
  CheckScopeBlock,
  CheckCapturedArguments,
} from './-debug-strip';
import { CONSTANTS } from '../../symbols';
import { DEBUG } from '@glimmer/env';
import createCurrySource from '../../sources/curry-value';
import { isCurriedType, resolveCurriedValue } from '../../curried-value';
import { reifyPositional } from '../../vm/arguments';

export type FunctionExpression<T> = (vm: PublicVM) => Source<T>;

APPEND_OPCODES.add(Op.Curry, (vm, { op1: type, op2: _isStrict }) => {
  let stack = vm.stack;

  let definition = check(stack.pop(), CheckSource);
  let capturedArgs = check(stack.pop(), CheckCapturedArguments);

  let owner = vm.getOwner();
  let resolver = vm.runtime.resolver;

  let isStrict = false;

  if (DEBUG) {
    // strict check only happens in DEBUG builds, no reason to load it otherwise
    isStrict = vm[CONSTANTS].getValue<boolean>(decodeHandle(_isStrict));
  }

  vm.loadValue(
    $v0,
    createCurrySource(type as CurriedType, definition, owner, capturedArgs, resolver, isStrict)
  );
});

APPEND_OPCODES.add(Op.DynamicHelper, (vm) => {
  let stack = vm.stack;
  let ref = check(stack.pop(), CheckSource);
  let args = check(stack.pop(), CheckArguments).capture();

  let helperSource: Source;
  let initialOwner: Owner = vm.getOwner();

  let helperInstanceSource = createCache(() => {
    if (helperSource !== undefined) {
      destroy(helperSource);
    }

    let definition = getValue(ref);

    if (isCurriedType(definition, CurriedType.Helper)) {
      let { definition: resolvedDef, owner, positional, named } = resolveCurriedValue(definition);

      let helper = resolveHelper(vm[CONSTANTS], resolvedDef, ref);

      if (named !== undefined) {
        args.named = assign({}, ...named, args.named);
      }

      if (positional !== undefined) {
        args.positional = positional.concat(args.positional) as CapturedPositionalArguments;
      }

      helperSource = helper(args, owner);

      associateDestroyableChild(helperInstanceSource, helperSource);
    } else if (isObject(definition)) {
      let helper = resolveHelper(vm[CONSTANTS], definition, ref);
      helperSource = helper(args, initialOwner);

      if (_hasDestroyableChildren(helperSource)) {
        associateDestroyableChild(helperInstanceSource, helperSource);
      }
    } else {
      helperSource = UNDEFINED_SOURCE;
    }
  });

  let helperValueSource = createCache(() => {
    getValue(helperInstanceSource);
    return getValue(helperSource);
  });

  vm.associateDestroyable(helperInstanceSource);
  vm.loadValue($v0, helperValueSource);
});

function resolveHelper(
  constants: RuntimeConstants & ResolutionTimeConstants,
  definition: HelperDefinitionState,
  ref: Source
): Helper {
  let handle = constants.helper(definition, null, true)!;

  if (DEBUG && handle === null) {
    throw new Error(
      `Expected a dynamic helper definition, but received an object or function that did not have a helper manager associated with it. The dynamic invocation was \`{{${getDebugLabel(
        ref
      )}}}\` or \`(${getDebugLabel(
        ref
      )})\`, and the incorrect definition is the value at the path \`${getDebugLabel(
        ref
      )}\`, which was: ${debugToString!(definition)}`
    );
  }

  return constants.getValue(handle);
}

APPEND_OPCODES.add(Op.Helper, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm[CONSTANTS].getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());

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
  let expr = check(vm.stack.pop(), CheckSource);
  vm.scope().bindSymbol(symbol, expr);
});

APPEND_OPCODES.add(Op.SetBlock, (vm, { op1: symbol }) => {
  let handle = check(vm.stack.pop(), CheckCompilableBlock);
  let scope = check(vm.stack.pop(), CheckScope);
  let table = check(vm.stack.pop(), CheckBlockSymbolTable);

  vm.scope().bindBlock(symbol, [handle, scope, table]);
});

APPEND_OPCODES.add(Op.ResolveMaybeLocal, (vm, { op1: _name }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let locals = vm.scope().getPartialMap()!;

  let ref = locals[name];
  if (ref === undefined) {
    ref = pathSourceFor(vm.getSelf(), name);
  }

  vm.stack.push(ref);
});

APPEND_OPCODES.add(Op.RootScope, (vm, { op1: symbols }) => {
  vm.pushRootScope(symbols, vm.getOwner());
});

APPEND_OPCODES.add(Op.GetProperty, (vm, { op1: _key }) => {
  let key = vm[CONSTANTS].getValue<string>(_key);
  let expr = check(vm.stack.pop(), CheckSource);
  vm.stack.push(pathSourceFor(expr, key));
});

APPEND_OPCODES.add(Op.GetBlock, (vm, { op1: _block }) => {
  let { stack } = vm;
  let block = vm.scope().getBlock(_block);

  stack.push(block);
});

APPEND_OPCODES.add(Op.SpreadBlock, (vm) => {
  let { stack } = vm;
  let block = check(stack.pop(), CheckOption(CheckOr(CheckScopeBlock, CheckUndefinedSource)));

  if (block && !isUndefinedSource(block)) {
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

function isUndefinedSource(input: ScopeBlock | Source): input is Source {
  assert(
    Array.isArray(input) || input === UNDEFINED_SOURCE,
    'a reference other than UNDEFINED_REFERENCE is illegal here'
  );
  return input === UNDEFINED_SOURCE;
}

APPEND_OPCODES.add(Op.HasBlock, (vm) => {
  let { stack } = vm;
  let block = check(stack.pop(), CheckOption(CheckOr(CheckScopeBlock, CheckUndefinedSource)));

  if (block && !isUndefinedSource(block)) {
    stack.push(TRUE_SOURCE);
  } else {
    stack.push(FALSE_SOURCE);
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
  vm.stack.push(hasBlockParams ? TRUE_SOURCE : FALSE_SOURCE);
});

APPEND_OPCODES.add(Op.Concat, (vm, { op1: count }) => {
  let out: Array<Source<unknown>> = new Array(count);

  for (let i = count; i > 0; i--) {
    let offset = i - 1;
    out[offset] = check(vm.stack.pop(), CheckSource);
  }

  vm.stack.push(createConcatSource(out));
});

APPEND_OPCODES.add(Op.IfInline, (vm) => {
  let condition = check(vm.stack.pop(), CheckSource);
  let truthy = check(vm.stack.pop(), CheckSource);
  let falsy = check(vm.stack.pop(), CheckSource);

  vm.stack.push(
    createCache(() => {
      if (toBool(getValue(condition)) === true) {
        return getValue(truthy);
      } else {
        return getValue(falsy);
      }
    })
  );
});

APPEND_OPCODES.add(Op.Not, (vm) => {
  let ref = check(vm.stack.pop(), CheckSource);

  vm.stack.push(
    createCache(() => {
      return !toBool(getValue(ref));
    })
  );
});

APPEND_OPCODES.add(Op.GetDynamicVar, (vm) => {
  let scope = vm.dynamicScope();
  let stack = vm.stack;
  let nameSource = check(stack.pop(), CheckSource);

  stack.push(
    createCache(() => {
      let name = String(getValue(nameSource));
      return getValue(scope.get(name));
    })
  );
});

APPEND_OPCODES.add(Op.Log, (vm) => {
  let { positional } = check(vm.stack.pop(), CheckArguments).capture();

  vm.loadValue(
    $v0,
    createCache(() => {
      // eslint-disable-next-line no-console
      console.log(...reifyPositional(positional));
    })
  );
});
