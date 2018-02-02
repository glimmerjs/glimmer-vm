import { Simple, Option } from '@glimmer/interfaces';
import { InstructionListExecutor, InstructionListEncoder, Context } from "..";

let executor: InstructionListExecutor;
let dom: DOMOperations;
let cx: Context;
let encoder: InstructionListEncoder;

type DOMOperation = [string] | [string, any] | [string, any, any, any];

class DOMOperations {
  operations: DOMOperation[] = [];

  appendText(text: string) {
    this.operations.push(['appendText', text]);
  }

  appendComment(text: string) {
    this.operations.push(['appendComment', text]);
  }

  openElement(tagName: string) {
    this.operations.push(['openElement', tagName]);
  }

  pushRemoteElement(element: Simple.Element, guid: string, nextSibling: Option<Simple.Node>) {
    this.operations.push(['pushRemoteElement', element, guid, nextSibling]);
  }

  popRemoteElement() {
    this.operations.push(['popRemoteElement']);
  }
}

QUnit.module("Instruction List - DOM", {
  beforeEach() {
    cx = new Context();
    dom = new DOMOperations();
    executor = new InstructionListExecutor(dom as any, cx);
    encoder = new InstructionListEncoder(cx);
  }
});

QUnit.test("AppendText", function(assert) {
  encoder.appendText('hello world');
  executor.execute(encoder.finalize());
  assert.deepEqual(dom.operations, [['appendText', 'hello world']]);
});

QUnit.test("AppendComment", function(assert) {
  encoder.appendComment('goodbye world');
  executor.execute(encoder.finalize());
  assert.deepEqual(dom.operations, [['appendComment', 'goodbye world']]);
});

QUnit.test("OpenElement", function(assert) {
  encoder.openElement('span');
  executor.execute(encoder.finalize());
  assert.deepEqual(dom.operations, [['openElement', 'span']]);
});

QUnit.test("PushRemoteElement", function(assert) {
  const element = { tagName: 'span' };
  const nextSibling = { nodeType: 1 };
  encoder.pushRemoteElement(element as any, 'the-guid', nextSibling as any);
  executor.execute(encoder.finalize());

  assert.deepEqual(dom.operations, [['pushRemoteElement', element, 'the-guid', nextSibling]]);
  assert.strictEqual(dom.operations[0][1], element);
  assert.strictEqual(dom.operations[0][3], nextSibling);
});

QUnit.test("PopRemoteElement", function(assert) {
  encoder.popRemoteElement();
  executor.execute(encoder.finalize());

  assert.deepEqual(dom.operations, [['popRemoteElement']]);
});

QUnit.test("Multiple instructions", function(assert) {
  const element = { tagName: 'span' };
  const nextSibling = { nodeType: 1 };

  encoder.openElement('span');
  encoder.pushRemoteElement(element as any, 'the-guid', nextSibling as any);
  encoder.appendText('hello world');

  executor.execute(encoder.finalize());

  assert.deepEqual(dom.operations, [
    ['openElement', 'span'],
    ['pushRemoteElement', element, 'the-guid', nextSibling],
    ['appendText', 'hello world']
  ]);

  assert.strictEqual(dom.operations[1][1], element);
  assert.strictEqual(dom.operations[1][3], nextSibling);
});
