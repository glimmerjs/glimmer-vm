import { debug, logOpcode, opcodeMetadata, recordStackSize } from '@glimmer/debug';
import type {
  Dict,
  Maybe,
  Nullable,
  RuntimeOp,
  SomeVmOp,
  VmMachineOp,
  VmOp,
} from '@glimmer/interfaces';
import { LOCAL_DEBUG, LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { valueForRef } from '@glimmer/reference';
import { assert, LOCAL_LOGGER, unwrap } from '@glimmer/util';
import { $fp, $pc, $ra, $sp } from '@glimmer/vm';

import { isScopeReference } from './scope';
import { CONSTANTS, INNER_VM } from './symbols';
import type { VM, LowLevelVM } from './vm';
import type { DebugVM, InternalVM } from './vm/append';
import { CURSOR_STACK } from './vm/element-builder';
import { sizeof, type RuntimeOpImpl, isMachine, opType } from '@glimmer/program';

export interface OpcodeJSON {
  type: number | string;
  guid?: Nullable<number>;
  deopted?: boolean;
  args?: string[];
  details?: Dict<Nullable<string>>;
  children?: OpcodeJSON[];
}

export type Operand1 = number;
export type Operand2 = number;
export type Operand3 = number;

export type Syscall = (vm: InternalVM, opcode: RuntimeOp) => void;
export type MachineOpcode = (vm: LowLevelVM, opcode: RuntimeOp) => void;

export type Evaluate =
  | { syscall: true; evaluate: Syscall }
  | { syscall: false; evaluate: MachineOpcode };

export type DebugState = {
  pc: number;
  sp: number;
  type: VmMachineOp | VmOp;
  isMachine: 0 | 1;
  size: number;
  params?: Maybe<Dict> | undefined;
  name?: string | undefined;
  state: unknown;
};

export class AppendOpcodes {
  readonly #evaluateOpcode: Evaluate[] = [];

  add<Name extends VmOp>(name: Name, evaluate: Syscall): void;
  add<Name extends VmMachineOp>(name: Name, evaluate: MachineOpcode, kind: 'machine'): void;
  add<Name extends SomeVmOp>(
    name: Name,
    evaluate: Syscall | MachineOpcode,
    kind = 'syscall'
  ): void {
    this.#evaluateOpcode[name as number] = {
      syscall: kind !== 'machine',
      evaluate,
    } as Evaluate;
  }

  static {
    if (import.meta.env.DEV) {
      Reflect.defineProperty(AppendOpcodes.prototype, 'debug', {
        enumerable: false,
        configurable: true,
        writable: false,
        value: {
          before: (vm: VM, opcode: RuntimeOpImpl): DebugState => {
            let params: Maybe<Dict> = undefined;
            let opName: string | undefined = undefined;

            if (LOCAL_SHOULD_LOG) {
              let pos = vm[INNER_VM].fetchRegister($pc) - sizeof(opcode);

              [opName, params] = debug(vm[CONSTANTS], opcode, isMachine(opcode))!;

              // console.log(`${typePos(vm['pc'])}.`);
              LOCAL_LOGGER.log(`${pos}. ${logOpcode(opName, params)}`);

              let debugParams = [];
              for (let prop in params) {
                debugParams.push(prop, '=', params[prop]);
              }

              LOCAL_LOGGER.log(...debugParams);
            }

            let sp: number;

            if (LOCAL_DEBUG) {
              sp = vm.fetchValue($sp);
            }

            recordStackSize(vm.fetchValue($sp));
            return {
              sp: sp!,
              pc: vm.fetchValue($pc),
              name: opName,
              params,
              type: opType(opcode),
              isMachine: isMachine(opcode),
              size: sizeof(opcode),
              state: undefined,
            };
          },

          after: (vm: VM, pre: DebugState, debug: DebugVM): void => {
            let { sp, type, isMachine, pc } = pre;

            if (import.meta.env.DEV && LOCAL_DEBUG) {
              let meta = opcodeMetadata(type, isMachine);
              let actualChange = vm.fetchValue($sp) - sp;
              if (
                meta &&
                meta.check &&
                typeof meta.stackChange! === 'number' &&
                meta.stackChange !== actualChange
              ) {
                throw new Error(
                  `Error in ${pre.name}:\n\n${pc}. ${logOpcode(
                    pre.name!,
                    pre.params
                  )}\n\nStack changed by ${actualChange}, expected ${meta.stackChange}`
                );
              }

              if (LOCAL_SHOULD_LOG) {
                LOCAL_LOGGER.log(
                  '%c -> pc: %d, ra: %d, fp: %d, sp: %d, s0: %O, s1: %O, t0: %O, t1: %O, v0: %O',
                  'color: orange',
                  vm[INNER_VM].fetchRegister($pc),
                  vm[INNER_VM].fetchRegister($ra),
                  vm[INNER_VM].fetchRegister($fp),
                  vm[INNER_VM].fetchRegister($sp),
                  vm['s0'],
                  vm['s1'],
                  vm['t0'],
                  vm['t1'],
                  vm['v0']
                );
                LOCAL_LOGGER.log('%c -> eval stack', 'color: red', vm.stack.toArray());
                LOCAL_LOGGER.log(
                  '%c -> block stack',
                  'color: magenta',
                  vm.elements().debugBlocks()
                );
                LOCAL_LOGGER.log(
                  '%c -> destructor stack',
                  'color: violet',
                  unwrap(vm.debug).destroyableStack.toArray()
                );
                if (debug.getStacks(vm).scope.current === null) {
                  LOCAL_LOGGER.log('%c -> scope', 'color: green', 'null');
                } else {
                  LOCAL_LOGGER.log(
                    '%c -> scope',
                    'color: green',
                    vm.scope().slots.map((s) => (isScopeReference(s) ? valueForRef(s) : s))
                  );
                }

                LOCAL_LOGGER.log(
                  '%c -> elements',
                  'color: blue',
                  vm.elements()[CURSOR_STACK].current!.element
                );

                LOCAL_LOGGER.log(
                  '%c -> constructing',
                  'color: aqua',
                  vm.elements()['constructing']
                );
              }
            }
          },
        },
      });
    }
  }

  declare readonly debug?: {
    readonly before: (vm: VM, opcode: RuntimeOp) => DebugState;
    readonly after: (vm: VM, pre: unknown, debug: DebugVM) => void;
  };

  evaluate(vm: VM, opcode: RuntimeOp, type: number) {
    let operation = unwrap(this.#evaluateOpcode[type]);

    if (operation.syscall) {
      assert(
        !isMachine(opcode),
        `BUG: Mismatch between operation.syscall (${
          operation.syscall
        }) and opcode.isMachine (${isMachine(opcode)}) for ${opType(opcode)}`
      );
      operation.evaluate(vm, opcode);
    } else {
      assert(
        isMachine(opcode),
        `BUG: Mismatch between operation.syscall (${
          operation.syscall
        }) and opcode.isMachine (${isMachine(opcode)}) for ${opType(opcode)}`
      );
      operation.evaluate(vm[INNER_VM], opcode);
    }
  }
}

export const APPEND_OPCODES = new AppendOpcodes();
