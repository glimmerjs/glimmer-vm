import { ElementBuilder } from '../element-builder';
import { Context } from '../gbox';

export const enum Instruction {
  Push,
  AppendText,
  AppendComment,
  OpenElement,
  PushRemoteElement,
  PopRemoteElement
}

/**
 * An InstructionList encodes a list of operations that can only be performed
 * from JavaScript running on the main thread into a binary data structure.
 * Other contexts (e.g. code running in WebAssembly or a Web Worker) can create
 * this data structure locally, then transfer it to the main thread for
 * execution, avoiding costly context switches.
 */
export default class InstructionListExecutor {
  constructor(private elementBuilder: ElementBuilder, private cx: Context) { }

  execute(buf: ArrayBuffer) {
    const list = new Uint32Array(buf);
    const { elementBuilder, cx } = this;
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
          elementBuilder.pushRemoteElement(op1, op2, stack.pop());
          break;
        case Instruction.PopRemoteElement:
          elementBuilder.popRemoteElement();
          break;
      }
    }
  }
}
