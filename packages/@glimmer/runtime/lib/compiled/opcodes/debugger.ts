import type { Scope } from '@glimmer/interfaces';
import type { Reactive } from '@glimmer/reference';
import { getReactiveProperty, unwrapReactive } from '@glimmer/reference';
import { decodeHandle, dict, unwrap } from '@glimmer/util';
import { Op } from '@glimmer/vm';

import { APPEND_OPCODES } from '../../opcodes';

export type DebugGet = (path: string) => unknown;

export type DebugCallback = (context: unknown, get: DebugGet) => void;

function debugCallback(context: unknown, get: DebugGet): void {
  // eslint-disable-next-line no-console
  console.info('Use `context`, and `get(<path>)` to debug this template.');

  // for example...
  context === get('this');

  // eslint-disable-next-line no-debugger
  debugger;
}

let callback = debugCallback;

// For testing purposes
export function setDebuggerCallback(cb: DebugCallback) {
  callback = cb;
}

export function resetDebuggerCallback() {
  callback = debugCallback;
}

class ScopeInspector {
  private locals = dict<Reactive>();

  constructor(
    private scope: Scope,
    symbols: string[],
    debugInfo: number[]
  ) {
    for (const slot of debugInfo) {
      let name = unwrap(symbols[slot - 1]);
      let ref = scope.getSymbol(slot);
      this.locals[name] = ref;
    }
  }

  get(path: string): Reactive {
    let { scope, locals } = this;
    let parts = path.split('.');
    let [head, ...tail] = path.split('.') as [string, ...string[]];

    let evalScope = scope.getEvalScope()!;
    let ref: Reactive;

    if (head === 'this') {
      ref = scope.getSelf();
    } else if (locals[head]) {
      ref = unwrap(locals[head]);
    } else if (head.indexOf('@') === 0 && evalScope[head]) {
      ref = evalScope[head] as Reactive;
    } else {
      ref = this.scope.getSelf();
      tail = parts;
    }

    return tail.reduce((r, part) => getReactiveProperty(r, part), ref);
  }
}

APPEND_OPCODES.add(Op.Debugger, (vm, { op1: _symbols, op2: _debugInfo }) => {
  let symbols = vm.constants.getArray<string[]>(_symbols);
  let debugInfo = vm.constants.getArray<number[]>(decodeHandle(_debugInfo));
  let inspector = new ScopeInspector(vm.scope, symbols, debugInfo);

  // @todo how should {{debugger}} handle errors?
  callback(unwrapReactive(vm.getSelf()), (path) => unwrapReactive(inspector.get(path)));
});
