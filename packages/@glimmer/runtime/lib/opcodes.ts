import { Opaque, Opcode } from '@glimmer/interfaces';
import { DEBUG } from '@glimmer/local-debug-flags';
import { debug, logOpcode } from '@glimmer/opcode-compiler';
import { Tag } from '@glimmer/reference';
import { Dict, Option, Slice as ListSlice, fillNulls, initializeGuid, typePos } from '@glimmer/util';
import { Op } from '@glimmer/vm';
import { UpdatingVM, VM } from './vm';

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

export type EvaluateOpcode = (vm: VM<Opaque>, opcode: Opcode) => void;

export class AppendOpcodes {
  private evaluateOpcode: EvaluateOpcode[] = fillNulls<EvaluateOpcode>(Op.Size).slice();

  add<Name extends Op>(name: Name, evaluate: EvaluateOpcode): void {
    this.evaluateOpcode[name as number] = evaluate;
  }

  evaluate(vm: VM<Opaque>, opcode: Opcode, type: number) {
    let func = this.evaluateOpcode[type];
    if (DEBUG) {
      /* tslint:disable */
      let [name, params] = debug(vm.constants, opcode.type, opcode.op1, opcode.op2, opcode.op3);
      // console.log(`${typePos(vm['pc'])}.`);
      console.log(`${typePos(vm['pc'])}. ${logOpcode(name, params)}`);
      console.log(...debug(vm.constants, type, opcode.op1, opcode.op2, opcode.op3));
      /* tslint:enable */
    }

    func(vm, opcode);

    if (DEBUG) {
      /* tslint:disable */
      console.log('%c -> pc: %d, ra: %d, fp: %d, sp: %d, s0: %O, s1: %O, t0: %O, t1: %O', 'color: orange', vm['pc'], vm['ra'], vm['fp'], vm['sp'], vm['s0'], vm['s1'], vm['t0'], vm['t1']);
      console.log('%c -> eval stack', 'color: red', vm.stack.toArray());
      console.log('%c -> scope', 'color: green', vm.scope()['slots'].map(s => s && s['value'] ? s['value']() : s));
      console.log('%c -> elements', 'color: blue', vm.elements()['cursorStack']['stack'].map((c: any) => c.element));
      /* tslint:enable */
    }
  }
}

export const APPEND_OPCODES = new AppendOpcodes();

export abstract class AbstractOpcode {
  type: string;
  _guid: number;

  constructor() {
    initializeGuid(this);
  }

  toJSON(): OpcodeJSON {
    return { guid: this._guid, type: this.type };
  }
}

export abstract class UpdatingOpcode extends AbstractOpcode {
  abstract tag: Tag;

  next: Option<UpdatingOpcode> = null;
  prev: Option<UpdatingOpcode> = null;

  abstract evaluate(vm: UpdatingVM<Opaque>): void;
}

export type UpdatingOpSeq = ListSlice<UpdatingOpcode>;
