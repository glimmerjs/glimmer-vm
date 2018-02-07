import { Context } from '../gbox';
import { Instruction as I } from './executor';
import { WasmLowLevelVM } from '@glimmer/low-level';

export default class InstructionListEncoder {
  constructor(private vm: WasmLowLevelVM, private cx: Context) { }

  private encode(inst: I, op1?: any, op2?: any) {
    const { vm, cx } = this;
    vm.instruction_encode(inst, cx.encode(op1), cx.encode(op2));
  }

  openElement(tagName: string) {
    this.encode(I.OpenElement, tagName);
  }
}
