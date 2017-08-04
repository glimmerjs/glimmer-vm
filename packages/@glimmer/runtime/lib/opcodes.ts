import { Option, Dict, Slice as ListSlice, initializeGuid, fillNulls, typePos } from '@glimmer/util';
import { Op } from '@glimmer/vm';
import { Tag } from '@glimmer/reference';
import { VM, UpdatingVM } from './vm';
import { Opcode } from './environment';
import { DEBUG, CI } from '@glimmer/local-debug-flags';
import { debug, logOpcode } from "@glimmer/opcode-compiler";

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

export type EvaluateOpcode = (vm: VM, opcode: Opcode) => void;

export class AppendOpcodes {
  private evaluateOpcode: EvaluateOpcode[] = fillNulls<EvaluateOpcode>(Op.Size).slice();

  add<Name extends Op>(name: Name, evaluate: EvaluateOpcode): void {
    this.evaluateOpcode[name as number] = evaluate;
  }

  evaluate(vm: VM, opcode: Opcode, type: number) {
    let func = this.evaluateOpcode[type];
    if (!CI && DEBUG) {
      /* tslint:disable */
      let [name, params] = debug(vm.constants, opcode.type, opcode.op1, opcode.op2, opcode.op3);
      console.log(`${typePos(vm['pc'])}. ${logOpcode(name, params)}`);
      // console.log(...debug(vm.constants, type, opcode.op1, opcode.op2, opcode.op3));
      /* tslint:enable */
    }

    func(vm, opcode);

    if (!CI && DEBUG) {
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
  public type: string;
  public _guid: number;

  constructor() {
    initializeGuid(this);
  }

  toJSON(): OpcodeJSON {
    return { guid: this._guid, type: this.type };
  }
}

export abstract class UpdatingOpcode extends AbstractOpcode {
  public abstract tag: Tag;

  next: Option<UpdatingOpcode> = null;
  prev: Option<UpdatingOpcode> = null;

  abstract evaluate(vm: UpdatingVM): void;
}

export type UpdatingOpSeq = ListSlice<UpdatingOpcode>;

export function inspect(opcodes: ReadonlyArray<AbstractOpcode>): string {
  let buffer: string[] = [];

  opcodes.forEach((opcode, i) => {
    _inspect(opcode.toJSON(), buffer, 0, i);
  });

  return buffer.join('');
}

function _inspect(opcode: OpcodeJSON, buffer: string[], level: number, index: number) {
  let indentation: string[] = [];

  for (let i=0; i<level; i++) {
    indentation.push('  ');
  }

  buffer.push(...indentation);
  buffer.push(`${index}. ${opcode.type}`);

  if (opcode.args || opcode.details) {
    buffer.push('(');

    if (opcode.args) {
      buffer.push(opcode.args.join(', '));
    }

    if (opcode.details) {
      let keys = Object.keys(opcode.details);

      if (keys.length) {
        if (opcode.args && opcode.args.length) {
          buffer.push(', ');
        }

        buffer.push(keys.map(key => `${key}=${opcode.details && opcode.details[key]}`).join(', '));
      }
    }

    buffer.push(')');
  }

  buffer.push('\n');

  if (opcode.children && opcode.children.length) {
    for (let i=0; i<opcode.children.length; i++) {
      _inspect(opcode.children[i], buffer, level+1, i);
    }
  }
}
