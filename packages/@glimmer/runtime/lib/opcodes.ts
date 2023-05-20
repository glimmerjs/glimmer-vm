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
import { $fp, $pc, $ra, $sp } from '@glimmer/vm-constants';

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

type Add = (<Name extends VmOp>(name: Name, evaluate: Syscall) => void) &
  (<Name extends VmMachineOp>(name: Name, evaluate: MachineOpcode, kind: 'machine') => void);

export class AppendOpcodes {
  readonly #evaluateOpcode: Evaluate[] = [];

  add: Add = <Name extends SomeVmOp>(
    name: Name,
    evaluate: Syscall | MachineOpcode,
    kind = 'syscall'
  ): void => {
    this.#evaluateOpcode[name as number] = {
      syscall: kind !== 'machine',
      evaluate,
    } as Evaluate;
  };

  static {
    if (import.meta.env.DEV) {
      Reflect.defineProperty(AppendOpcodes.prototype, 'debug', {
        enumerable: false,
        configurable: true,
        writable: false,
        value: {
          before: (vm: VM, opcode: RuntimeOpImpl): DebugState => {
            let parameters: Maybe<Dict>;
            let opName: string | undefined;

            if (LOCAL_SHOULD_LOG) {
              let pos = vm[INNER_VM].fetchRegister($pc) - sizeof(opcode);

              [opName, parameters] = debug(vm[CONSTANTS], opcode, isMachine(opcode))!;

              // console.log(`${typePos(vm['pc'])}.`);
              LOCAL_LOGGER.log(`${pos}. ${logOpcode(opName, parameters)}`);

              let debugParameters = [];
              for (let property in parameters) {
                debugParameters.push(property, '=', parameters[property]);
              }

              LOCAL_LOGGER.log(...debugParameters);
            }

            let sp: number;

            if (LOCAL_DEBUG) {
              sp = vm._fetchValue_($sp);
            }

            recordStackSize(vm._fetchValue_($sp));
            return {
              sp: sp!,
              pc: vm._fetchValue_($pc),
              name: opName,
              params: parameters,
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
              let actualChange = vm._fetchValue_($sp) - sp;
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
                let registers = debug.registers();

                LOCAL_LOGGER.log(
                  '%c -> pc: %d, ra: %d, fp: %d, sp: %d, s0: %O, s1: %O, t0: %O, t1: %O, v0: %O',
                  'color: orange',
                  vm[INNER_VM].fetchRegister($pc),
                  vm[INNER_VM].fetchRegister($ra),
                  vm[INNER_VM].fetchRegister($fp),
                  vm[INNER_VM].fetchRegister($sp),
                  registers.s0,
                  registers.s1,
                  registers.t0,
                  registers.t1,
                  registers.v0
                );
                LOCAL_LOGGER.log('%c -> eval stack', 'color: red', vm.stack.toArray());
                LOCAL_LOGGER.log(
                  '%c -> block stack',
                  'color: magenta',
                  vm._elements_().debugBlocks()
                );
                LOCAL_LOGGER.log(
                  '%c -> destructor stack',
                  'color: violet',
                  unwrap(vm.debug).destroyableStack.toArray()
                );
                if (debug.getStacks(vm)._scope_.current === null) {
                  LOCAL_LOGGER.log('%c -> scope', 'color: green', 'null');
                } else {
                  LOCAL_LOGGER.log(
                    '%c -> scope',
                    'color: green',
                    vm._scope_().slots.map((s) => (isScopeReference(s) ? valueForRef(s) : s))
                  );
                }

                LOCAL_LOGGER.log(
                  '%c -> elements',
                  'color: blue',
                  vm._elements_()[CURSOR_STACK].current!.element
                );

                LOCAL_LOGGER.log(
                  '%c -> constructing',
                  'color: aqua',
                  vm._elements_()['_constructing_']
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

  evaluate = (vm: VM, opcode: RuntimeOp, type: number) => {
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
  };
}

const APPEND_OPCODES = new AppendOpcodes();
export const define = APPEND_OPCODES.add;
export const evaluate = APPEND_OPCODES.evaluate;
export const debugOp = APPEND_OPCODES.debug;
