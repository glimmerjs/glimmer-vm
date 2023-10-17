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
import { LOCAL_DEBUG, LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { valueForRef } from '@glimmer/reference';
import { assert, fillNulls, LOCAL_LOGGER, unwrap } from '@glimmer/util';
import { $pc, $sp, Op } from '@glimmer/vm';

import { isScopeReference } from './scope';
import { CONSTANTS, DESTROYABLE_STACK, STACKS } from './symbols';
import type { LowLevelVM, VM } from './vm';
import type { InternalVM } from './vm/append';
import { CURSOR_STACK } from './vm/element-builder';

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
  private evaluateOpcode: Evaluate[] = fillNulls<Evaluate>(Op.Size).slice();

  add<Name extends VmOp>(name: Name, evaluate: Syscall): void;
  add<Name extends VmMachineOp>(name: Name, evaluate: MachineOpcode, kind: 'machine'): void;
  add<Name extends SomeVmOp>(
    name: Name,
    evaluate: Syscall | MachineOpcode,
    kind = 'syscall'
  ): void {
    this.evaluateOpcode[name as number] = {
      syscall: kind !== 'machine',
      evaluate,
    } as Evaluate;
  }

  debugBefore(vm: VM, opcode: RuntimeOp): DebugState {
    let params: Maybe<Dict> = undefined;
    let opName: string | undefined = undefined;

    if (LOCAL_TRACE_LOGGING) {
      let pos = vm.debug?.inner.fetchRegister($pc) - opcode.size;

      [opName, params] = debug(vm[CONSTANTS], opcode, opcode.isMachine)!;

      // console.log(`${typePos(vm['pc'])}.`);
      LOCAL_LOGGER.debug(`${pos}. ${logOpcode(opName, params)}`);

      let debugParams = [];
      for (let prop in params) {
        debugParams.push(prop, '=', params[prop]);
      }

      LOCAL_LOGGER.debug(...debugParams);
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
      type: opcode.type,
      isMachine: opcode.isMachine,
      size: opcode.size,
      state: undefined,
    };
  }

  debugAfter(vm: VM, pre: DebugState) {
    let { sp, type, isMachine, pc } = pre;

    if (LOCAL_DEBUG) {
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

      if (LOCAL_TRACE_LOGGING) {
        LOCAL_LOGGER.debug(
          '%c -> pc: %d, ra: %d, fp: %d, sp: %d, s0: %O, s1: %O, t0: %O, t1: %O, v0: %O',
          'color: orange',
          vm.debug.inner.debug.registers.pc,
          vm.debug.inner.debug.registers.ra,
          vm.debug.inner.debug.registers.fp,
          vm.debug.inner.debug.registers.sp,
          vm['s0'],
          vm['s1'],
          vm['t0'],
          vm['t1'],
          vm['v0']
        );
        LOCAL_LOGGER.debug('%c -> eval stack', 'color: red', vm.internalStack.toArray());
        LOCAL_LOGGER.debug('%c -> block stack', 'color: magenta', vm.elements().debugBlocks());
        LOCAL_LOGGER.debug(
          '%c -> destructor stack',
          'color: violet',
          vm[DESTROYABLE_STACK].toArray()
        );
        if (vm[STACKS].scope.current === null) {
          LOCAL_LOGGER.debug('%c -> scope', 'color: green', 'null');
        } else {
          LOCAL_LOGGER.debug(
            '%c -> scope',
            'color: green',
            vm.scope().slots.map((s) => (isScopeReference(s) ? valueForRef(s) : s))
          );
        }

        LOCAL_LOGGER.debug(
          '%c -> elements',
          'color: blue',
          vm.elements()[CURSOR_STACK].current!.element
        );

        LOCAL_LOGGER.debug('%c -> constructing', 'color: aqua', vm.elements()['constructing']);
      }
    }
  }

  evaluate(vm: VM, opcode: RuntimeOp, type: number) {
    let operation = unwrap(this.evaluateOpcode[type]);

    if (operation.syscall) {
      assert(
        !opcode.isMachine,
        `BUG: Mismatch between operation.syscall (${operation.syscall}) and opcode.isMachine (${opcode.isMachine}) for ${opcode.type}`
      );
      operation.evaluate(vm, opcode);
    } else {
      assert(
        opcode.isMachine,
        `BUG: Mismatch between operation.syscall (${operation.syscall}) and opcode.isMachine (${opcode.isMachine}) for ${opcode.type}`
      );
      operation.evaluate(vm.debug.inner, opcode);
    }
  }
}

export const APPEND_OPCODES = new AppendOpcodes();
