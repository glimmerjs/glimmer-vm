import { ReferenceCache, Reference } from "@glimmer/reference";
import { ElementBuilder } from '../element-builder';
import { Context } from '../gbox';
import { VM } from '../../vm';
import { Assert } from '../../compiled/opcodes/vm';
import { Opaque } from "@glimmer/interfaces";

export const enum Instruction {
  Push,
  AppendText,
  AppendComment,
  OpenElement,
  PushRemoteElement,
  PopRemoteElement,
  UpdateWithReference,
  CloseElement,
}

/**
 * An InstructionList encodes a list of operations that can only be performed
 * from JavaScript running on the main thread into a binary data structure.
 * Other contexts (e.g. code running in WebAssembly or a Web Worker) can create
 * this data structure locally, then transfer it to the main thread for
 * execution, avoiding costly context switches.
 */
export default class InstructionListExecutor {
  constructor(
    private vm: VM<Opaque>,
    private elementBuilder: ElementBuilder,
    private cx: Context
  ) { }

  execute(buf: ArrayBuffer) {
    const list = new Uint32Array(buf);
    const { elementBuilder, cx, vm } = this;
    const stack: any[] = [];

    for (let i = 0; i < list.length; i += 3) {
      const inst = list[i];
      const op1 = cx.decode(list[i+1]);
      const op2 = cx.decode(list[i+2]);

      switch (inst) {
        case Instruction.Push:
          stack.push(op1);
          break;
        case Instruction.AppendText:
          elementBuilder.appendText(op1);
          break;
        case Instruction.AppendComment:
          elementBuilder.appendComment(op1);
          break;
        case Instruction.OpenElement:
          elementBuilder.openElement(op1);
          break;
        case Instruction.PushRemoteElement:
          elementBuilder.pushRemoteElement(op1.value(), op2.value(), stack.pop().value());
          break;
        case Instruction.PopRemoteElement:
          elementBuilder.popRemoteElement();
          break;
        case Instruction.UpdateWithReference:
          updateWithReference(vm, op1);
          break;
        case Instruction.CloseElement:
          elementBuilder.closeElement();
          break;
      }
    }
  }
}

function updateWithReference(vm: VM<Opaque>, ref: Reference<Opaque>): void {
  let cache = new ReferenceCache(ref);
  cache.peek();
  vm.updateWith(new Assert(cache));
}
