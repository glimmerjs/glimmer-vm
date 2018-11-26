import { LowLevelVM, VM, UpdatingVM } from './vm';

import {
  Option,
  Dict,
  Slice as ListSlice,
  initializeGuid,
  fillNulls,
  unreachable,
  assert,
} from '@glimmer/util';
import { recordStackSize } from '@glimmer/debug';
import { Op } from '@glimmer/vm';
import { Tag } from '@glimmer/reference';
import { METADATA } from '@glimmer/vm';
import { Opcode, Opaque } from '@glimmer/interfaces';
import { DEBUG, DEVMODE } from '@glimmer/local-debug-flags';
// these import bindings will be stripped from build
import { debug, logOpcode } from '@glimmer/opcode-compiler';
import { DESTRUCTOR_STACK, INNER_VM, CONSTANTS } from './symbols';
import { ScopeImpl } from './scope';
import { ReadonlyVM, MutVM, PartialVM } from './vm/append';

export interface OpcodeJSON {
  type: number | string;
  guid?: Option<number>;
  deopted?: boolean;
  args?: string[];
  details?: Dict<Option<string>>;
  children?: OpcodeJSON[];
}

export type Operand1 = number;
export type Operand2 = number;
export type Operand3 = number;

export type ReadonlySyscall = (vm: ReadonlyVM, opcode: Opcode) => void;
export type MutSyscall = (vm: MutVM, opcode: Opcode) => void;
export type PartialSyscall = (vm: PartialVM, opcode: Opcode) => void;
export type MachineOpcode = (vm: LowLevelVM, opcode: Opcode) => void;

export enum OpcodeKind {
  Machine,
  Readonly,
  Mut,
  Partial,
}

export type Evaluate =
  | { kind: OpcodeKind.Readonly; evaluate: ReadonlySyscall }
  | { kind: OpcodeKind.Mut; evaluate: MutSyscall }
  | { kind: OpcodeKind.Partial; evaluate: PartialSyscall }
  | { kind: OpcodeKind.Machine; evaluate: MachineOpcode };

export type DebugState = { sp: number; state: Opaque };

export class AppendOpcodes {
  private evaluateOpcode: Evaluate[] = fillNulls<Evaluate>(Op.Size).slice();

  add<Name extends Op>(name: Name, evaluate: ReadonlySyscall, kind: OpcodeKind.Readonly): void;
  add<Name extends Op>(name: Name, evaluate: MutSyscall, kind: OpcodeKind.Mut): void;
  add<Name extends Op>(name: Name, evaluate: PartialSyscall, kind: OpcodeKind.Partial): void;
  add<Name extends Op>(name: Name, evaluate: MachineOpcode, kind: OpcodeKind.Machine): void;
  add<Name extends Op>(
    name: Name,
    evaluate: ReadonlySyscall | MutSyscall | PartialSyscall | MachineOpcode,
    kind: OpcodeKind
  ): void {
    this.evaluateOpcode[name as number] = { kind, evaluate } as Evaluate;
  }

  debugBefore(vm: VM<Opaque>, opcode: Opcode, type: number): DebugState {
    if (DEBUG) {
      let pos = vm[INNER_VM].pc - opcode.size;
      /* tslint:disable */
      let [name, params] = debug(
        pos,
        vm[CONSTANTS],
        opcode.type,
        opcode.op1,
        opcode.op2,
        opcode.op3
      );
      // console.log(`${typePos(vm['pc'])}.`);
      console.log(`${pos}. ${logOpcode(name, params)}`);

      let debugParams = [];
      for (let prop in params) {
        debugParams.push(prop, '=', params[prop]);
      }

      console.log(...debugParams);
      /* tslint:enable */
    }

    let sp: number;
    let state: Opaque;

    if (DEVMODE) {
      let metadata = METADATA[type];

      if (metadata && metadata.before) {
        state = metadata.before(opcode, vm);
      } else {
        state = undefined;
      }

      sp = vm.stack.sp;
    }

    recordStackSize(vm.stack);
    return { sp: sp!, state };
  }

  debugAfter(vm: VM<Opaque>, opcode: Opcode, type: number, pre: DebugState) {
    let expectedChange: number;
    let { sp, state } = pre;

    let metadata = METADATA[type];
    if (metadata !== null) {
      if (typeof metadata.stackChange === 'number') {
        expectedChange = metadata.stackChange;
      } else {
        expectedChange = metadata.stackChange({ opcode, constants: vm[CONSTANTS], state });
        if (isNaN(expectedChange)) throw unreachable();
      }
    }

    if (DEBUG) {
      let actualChange = vm.stack.sp - sp!;
      if (
        metadata &&
        metadata.check &&
        typeof expectedChange! === 'number' &&
        expectedChange! !== actualChange
      ) {
        let pos = vm[INNER_VM].pc + opcode.size;
        let [name, params] = debug(
          pos,
          vm[CONSTANTS],
          opcode.type,
          opcode.op1,
          opcode.op2,
          opcode.op3
        );

        throw new Error(
          `Error in ${name}:\n\n${pos}. ${logOpcode(
            name,
            params
          )}\n\nStack changed by ${actualChange}, expected ${expectedChange!}`
        );
      }

      /* tslint:disable */
      console.log(
        '%c -> pc: %d, ra: %d, fp: %d, sp: %d, s0: %O, s1: %O, t0: %O, t1: %O, v0: %O',
        'color: orange',
        vm[INNER_VM]['pc'],
        vm[INNER_VM]['ra'],
        vm.stack['fp'],
        vm.stack['sp'],
        vm['s0'],
        vm['s1'],
        vm['t0'],
        vm['t1'],
        vm['v0']
      );
      console.log('%c -> eval stack', 'color: red', vm.stack.toArray());
      console.log('%c -> block stack', 'color: magenta', vm.elements.debugBlocks());
      console.log('%c -> destructor stack', 'color: violet', vm[DESTRUCTOR_STACK].toArray());
      if (vm['scopeStack'].current === null) {
        console.log('%c -> scope', 'color: green', 'null');
      } else {
        console.log(
          '%c -> scope',
          'color: green',
          (vm.scope as ScopeImpl)['slots'].map(s => (s && s['value'] ? s['value']() : s))
        );
      }
      console.log(
        '%c -> elements',
        'color: blue',
        vm.elements['cursorStack']['stack'].map((c: any) => c.element)
      );
      /* tslint:enable */
    }
  }

  evaluate(vm: VM<Opaque>, opcode: Opcode, type: number) {
    let operation = this.evaluateOpcode[type];

    switch (operation.kind) {
      case OpcodeKind.Machine:
        assert(
          opcode.isMachine,
          `BUG: Mismatch between operation.syscall (${operation.kind}) and opcode.isMachine (${
            opcode.isMachine
          }) for ${opcode.type}`
        );
        operation.evaluate(vm[INNER_VM], opcode);
        return;

      case OpcodeKind.Mut:
      case OpcodeKind.Partial:
        assert(
          !opcode.isMachine,
          `BUG: Mismatch between operation.syscall (${operation.kind}) and opcode.isMachine (${
            opcode.isMachine
          }) for ${opcode.type}`
        );
        operation.evaluate(vm, opcode);
    }
  }
}

export const APPEND_OPCODES = new AppendOpcodes();

export abstract class AbstractOpcode {
  public abstract type: string;
  public _guid!: number; // Set by initializeGuid() in the constructor

  constructor() {
    initializeGuid(this);
  }
}

export abstract class UpdatingOpcode extends AbstractOpcode {
  abstract readonly tag: Tag;

  readonly next: Option<UpdatingOpcode> = null;
  readonly prev: Option<UpdatingOpcode> = null;

  abstract evaluate(vm: UpdatingVM): void;
}

export type UpdatingOpSeq = ListSlice<UpdatingOpcode>;
