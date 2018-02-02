import { Simple, Option } from '@glimmer/interfaces';
import { Context } from '../gbox';
import { Instruction as I } from './executor';

const BUF_SIZE = 2048;

export default class InstructionListEncoder {
  instructions = new Uint32Array(new ArrayBuffer(BUF_SIZE));
  offset = 0;

  constructor(public cx: Context) { }

  encode(inst: I, op1?: any, op2?: any) {
    const { instructions } = this;
    if (this.offset + 3 >= instructions.length) {
      this.grow();
    }

    const { cx } = this;
    this.instructions[this.offset++] = inst;
    this.instructions[this.offset++] = cx.encode(op1);
    this.instructions[this.offset++] = cx.encode(op2);
  }

  grow() {
    let previous = this.instructions;
    this.instructions = new Uint32Array(new ArrayBuffer(previous.byteLength * 2));
    this.instructions.set(previous);
  }

  appendText(text: string) {
    this.encode(I.AppendText, text);
  }

  appendComment(text: string) {
    this.encode(I.AppendComment, text);
  }

  openElement(tagName: string) {
    this.encode(I.OpenElement, tagName);
  }

  pushRemoteElement(element: Simple.Element, guid: string, nextSibling: Option<Simple.Node>) {
    this.encode(I.Push, nextSibling);
    this.encode(I.PushRemoteElement, element, guid);
  }

  popRemoteElement() {
    this.encode(I.PopRemoteElement);
  }

  finalize(): ArrayBuffer {
    let offset = this.offset;
    this.offset = 0;
    return this.instructions.buffer.slice(0, offset * 4) as ArrayBuffer;
  }
}
