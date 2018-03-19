import { Opaque, Dict, Simple, Option } from "@glimmer/interfaces";
import { Stack, unwrap } from "@glimmer/util";
import { SerializedTemplateBlock, Statement, Ops, Expression, Attribute, SerializedInlineBlock, Core } from "@glimmer/wire-format";
import { Document } from "simple-dom";

const COLORS = {
  red: '#c66',
  green: '#6c6',
  yellow: '#cc6',
  black: '#000'
};

type Color = keyof typeof COLORS;

class Message {
  style: string[] = [];
  message = '';

  log(): void {
    console.log(this.message, ...this.style);
  }

  addString(message: string, color: Color = 'black'): this {
    this.message += `%c${message}`;
    this.style.push(`color:${COLORS[color]}`);
    return this;
  }

  space(): this {
    this.addString(' ');
    return this;
  }

  addMessage(message: Message): this {
    this.message += message.message;
    this.style = [...this.style, ...message.style];
    return this;
  }
}

class Console {
  status(status: string, message: string | Message, color: Color = 'green'): Message {
    let fullMessage;

    if (typeof message === 'string') {
      fullMessage = new Message().addString(status, color).space().addString(message);
    } else {
      fullMessage = new Message().addString(status, color).space().addMessage(message);
    }

    return fullMessage;
  }

  enter(status: string, message: string | Message, color: Color = 'green'): Message {
    return new Message().addString('-> ').addMessage(this.status(status, message, color));
  }

  exit(status: string, color: Color = 'green'): Message {
    return new Message().addString('<- ').addMessage(new Message().addString(status, color));
  }
}

const CONSOLE = new Console();

/**
 * The purpose of this file is to create a simplistic but aspiration
 * model of the production append machine.
 *
 * In particular, it does not:
 *
 * - support updating of any kind
 * - support component managers or any JS intervention in the component
 *   rendering process
 *
 * But it does:
 *
 * - faithfully model the stack machine in the append VM
 * - use runtime structures like dictionaries to model scopes, etc.
 */

export type UserHelper = (params: Opaque[], hash: Dict<Opaque>) => Opaque;

class Frame {
  constructor(
    private block: SerializedTemplateBlock,
    public parameters: Opaque[]
  ) {}

  get(slot: number): Opaque {
    return this.parameters[slot];
  }

  bind(slot: number, value: Opaque): void {
    this.parameters[slot] = value;
  }

  copy(): Frame {
    return new Frame(this.block, this.parameters.slice());
  }

  get symbolMap(): string[] {
    return this.block.symbols;
  }
}

class EvalStack {
  inner: Opaque[] = [];
  frames: Stack<Frame> = new Stack();

  get frame(): Frame {
    return unwrap(this.frames.current);
  }

  private pushFrame(frame: Frame): Frame {
    this.frames.push(frame);
    CONSOLE.enter('frame', this.inspectFrame()).log();
    return frame;
  }

  pushNewFrame(callee: SerializedTemplateBlock, params: Opaque[]) {
    this.pushFrame(new Frame(callee, params));
  }

  resumeFrame(frame: Frame): Frame {
    return this.pushFrame(frame);
  }

  inspectFrame(): string {
    return JSON.stringify(this.frame.parameters, (_k, v) => {
      if (v && typeof v.block === 'object') {
        return '[[Block]]';
      } else {
        return v;
      }
    });
  }

  popFrame(): void {
    CONSOLE.exit('frame').log();
    this.frames.pop();
  }

  push(value: Opaque) {
    this.inner.push(value);
  }

  pop(): Opaque {
    return this.inner.pop();
  }

  peek(): Opaque {
    return this.inner[this.inner.length - 1];
  }

  get(slot: number): Opaque {
    return this.frame.get(slot);
  }

  get sp(): number {
    return this.inner.length;
  }

  get symbolMap(): string[] {
    return this.frame.symbolMap;
  }

  getByName(symbol: string): Opaque {
    let index = this.symbolMap.indexOf(symbol);

    if (index === -1) {
      return;
    } else {
      return this.frame.get(index);
    }
  }
}

class State {
  private elementStack: Simple.Element[];
  public stack: EvalStack = new EvalStack();

  constructor(private doc: Simple.Document) {
    this.elementStack = [doc.createElement('div')];
  }

  // CONVENIENCE

  inspectStack(): string {
    return JSON.stringify(this.stack.inner);
  }

  get element() {
    return this.elementStack[this.elementStack.length - 1];
  }

  // HTML

  appendText(text: string) {
    this.element.insertBefore(this.doc.createTextNode(text), null);
  }

  openElement(tag: string) {
    this.elementStack.push(this.doc.createElement(tag));
  }

  closeElement() {
    let element = this.elementStack.pop()!;
    this.element.insertBefore(element, null);
  }

  setAttribute(name: string, value: string) {
    this.element.setAttribute(name, value);
  }

  // WRAP UP

  finish(): Simple.Element {
    return this.element;
  }
}

export type Macro = (positional: Expression[], named: Dict<Expression>, evaluate: (expr: Expression) => Opaque) => Opaque;

export class Interpreter {
  private doc = new Document();
  private state = new State(this.doc);

  constructor(private templates: Dict<SerializedTemplateBlock>, private helpers: Dict<UserHelper> = {}) {

  }

  private get stack(): EvalStack {
    return this.state.stack;
  }

  main(context: Opaque): Simple.Element {
    let template = this.templates['main'];

    this.stack.pushNewFrame(template, [context]);
    this.evaluateLayout('main');
    this.stack.popFrame();

    return this.state.finish();
  }

  evaluateLayout(templateName: string) {
    CONSOLE.enter('evaluate', templateName).log();

    try {
      let template = this.templates[templateName];

      template.statements.forEach(s => {
        this.evaluateStatement(s);
      });

      return this.state.finish();
    } finally {
      CONSOLE.exit('evaluate').log();
    }
  }

  evaluateBlock(block: SerializedInlineBlock) {
    block.statements.forEach(s => {
      this.evaluateStatement(s);
    });
  }

  evaluateStatement(statement: Statement) {
    let { state, stack } = this;

    CONSOLE.enter('statement', this.sexp(statement)).log();
    CONSOLE.status('   frame', this.stack.inspectFrame()).log();

    try {
      switch (statement[0]) {
        case Ops.Text:
          return state.appendText(statement[1]);

        case Ops.Append:
          return this.appendExpr(statement[1], statement[2]);

        case Ops.OpenElement:
          return state.openElement(statement[1]);

        case Ops.FlushElement:
          // Relevant for component merging
          return;

        case Ops.CloseElement:
          return state.closeElement();

        case Ops.StaticAttr:
          this.evaluateExpr(statement[2]);
          return state.setAttribute(statement[1], String(stack.pop()));

        case Ops.DynamicAttr:
          this.evaluateExpr(statement[2]);
          return state.setAttribute(statement[1], String(stack.pop()));

        case Ops.Component:
          return this.component(statement[1], statement[2], statement[3], statement[4]);

        case Ops.Yield:
          return this.yield(statement[1], statement[2]);

        default:
          throw new Error(`Unimplemented ${Ops[statement[0]]}`);
      }
    } finally {
      CONSOLE.status('   stack', this.state.inspectStack()).log();
      CONSOLE.exit('statement').log();
    }
  }

  component(name: string, _attrs: Attribute[], hash: Core.Hash, block: Option<SerializedInlineBlock>) {
    let callee = this.templates[name];

    // self
    let params: Opaque[] = [null];
    callee.symbols.forEach(() => {
      params.push(undefined);
    });

    callee.symbols.forEach((s, i) => {
      if (s === '&default') {
        params[i + 1] = { block, frame: this.stack.frame };
      } else if (s[0] === '@' && hash) {
        let index = hash[0].indexOf(s);
        if (index !== -1) {
          this.evaluateExpr(hash[1][index]);
          params[i + 1] = this.stack.pop();
        }
      }
    });

    this.stack.pushNewFrame(callee, params);

    this.evaluateLayout(name);

    this.stack.popFrame();
  }

  yield(to: number, params: Option<Expression[]>) {
    let { block, frame: original } = this.stack.get(to) as { block: SerializedInlineBlock, frame: Frame };

    let frame = original.copy();

    block.parameters.forEach((calleeIndex, callerIndex) => {
      if (params && params.length > callerIndex) {
        this.evaluateExpr(params[callerIndex]);
        frame.bind(calleeIndex, this.stack.pop());
      } else {
        frame.bind(calleeIndex, undefined);
      }
    });

    this.stack.resumeFrame(frame);
    this.evaluateBlock(block);

    this.stack.popFrame();
  }

  appendExpr(expr: Expression, trusting: boolean): void {
    this.evaluateExpr(expr);
    let value = this.stack.pop();

    if (!trusting) {
      this.state.appendText(String(value));
    }
  }

  private sexp(e: Expression | Statement): string {
    if (Array.isArray(e)) {
      let [op, ...rest] = e;
      let list = [Ops[op], ...rest.map(s => this.sexp(s))];
      return `(${list.join(' ')})`;
    } else if (e && typeof e === 'object') {
      let obj = [];
      for (let prop in e) {
        obj.push(`${prop}=${this.sexp(e[prop])}`);
      }

      return obj.join(' ');
    } else {
      return `${JSON.stringify(e)}`;
    }
  }

  evaluateExpr(expr: Expression) {
    try {
      if (!Array.isArray(expr)) {
        CONSOLE.enter('value', String(expr)).log();
        this.stack.push(expr);
        return;
      }

      CONSOLE.enter('expression', this.sexp(expr)).log();

      switch (expr[0]) {
        case Ops.Unknown:
          return this.unknown(expr[1]);

        case Ops.Get:
          return this.get(expr[1], expr[2]);

        case Ops.MaybeLocal:
          // Don't worry about eval
          return this.get(0, expr[1]);

        case Ops.HasBlock:
          return this.hasBlock(expr[1]);

        case Ops.HasBlockParams:
          return this.hasBlockParams(expr[1]);

        case Ops.Undefined:
          return this.stack.push(undefined);

        case Ops.Concat:
          return this.concat(expr[1]);

        default:
          throw new Error(`Unimplemented ${Ops[expr[0]]}`);
      }
    } finally {
      CONSOLE.status('   stack', this.state.inspectStack()).log();
      CONSOLE.exit('expression').log();
    }

  }

  unknown(path: string) {
    if (path in this.helpers) {
      let value = this.helpers[path]([], {});
      this.stack.push(value);
    } else {
      let self = this.stack.get(0);
      this.stack.push(self![path]);
    }
  }

  get(slot: number, path: string[]) {
    let value = this.stack.get(slot);
    path.forEach(part => value = value![part]);
    this.stack.push(value!);
  }

  hasBlock(slot: number) {
    let value = this.stack.get(slot);
    this.stack.push(!!value);
  }

  hasBlockParams(slot: number) {
    let block = this.stack.get(slot) as SerializedInlineBlock | undefined;
    let value = !!(block && block.parameters.length > 0);

    this.stack.push(value);
  }

  concat(params: Expression[]) {
    params.forEach(param => {
      this.evaluateExpr(param);
    });

    let value = [];

    for (let i = 0; i < params.length; i++) {
      value.unshift(String(this.stack.pop()));
    }

    this.stack.push(value.join(''));
  }
}
