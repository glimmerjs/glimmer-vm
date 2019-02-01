import { CompilerOps, Processor, Op, OpName, TemplateCompilerOps, PathHead } from './compiler-ops';
import { AST } from '@glimmer/syntax';
import { Option } from '@glimmer/interfaces';
import { Stack, expect } from '@glimmer/util';

export type InVariable = PathHead;
export type OutVariable = number;

export type OutOp<K extends keyof CompilerOps<OutVariable> = OpName> = Op<
  OutVariable,
  CompilerOps<OutVariable>,
  K
>;
export type InOp<K extends keyof TemplateCompilerOps = keyof TemplateCompilerOps> = Op<
  PathHead,
  TemplateCompilerOps,
  K
>;

export class SymbolAllocator
  implements Processor<CompilerOps<InVariable>, OutVariable, CompilerOps<OutVariable>> {
  private symbolStack = new Stack<AST.Symbols>();

  constructor(private ops: Array<InOp>, private strict: boolean) {}

  process(): OutOp[] {
    let out: OutOp[] = [];
    let { ops } = this;

    for (let i = 0; i < ops.length; i++) {
      let op = ops[i];
      let result = this.dispatch(op);

      if (result === undefined) {
        out.push(op as OutOp);
      } else {
        out.push(result as any);
      }
    }

    return out;
  }

  dispatch<O extends InOp>(op: O): unknown {
    let name = op[0];
    let operand = op[1];

    return (this[name] as any)(operand);
  }

  get symbols(): AST.Symbols {
    return expect(this.symbolStack.current, 'Expected a symbol table on the stack');
  }

  startProgram(op: AST.Template) {
    this.symbolStack.push(op.symbols!);
  }

  endProgram(_op: null) {
    this.symbolStack.pop();
  }

  startBlock(op: AST.Block) {
    this.symbolStack.push(op.symbols!);
  }

  endBlock(_op: null) {
    this.symbolStack.pop();
  }

  openNamedBlock(op: AST.ElementNode) {
    this.symbolStack.push(op.symbols!);
  }

  closeNamedBlock(_op: AST.ElementNode) {
    this.symbolStack.pop();
  }

  flushElement(op: AST.ElementNode) {
    this.symbolStack.push(op.symbols!);
  }

  closeElement(_op: AST.ElementNode) {
    this.symbolStack.pop();
  }

  closeComponent(_op: AST.ElementNode) {
    this.symbolStack.pop();
  }

  closeDynamicComponent(_op: AST.ElementNode) {
    this.symbolStack.pop();
  }

  attrSplat(_op: Option<InVariable>): OutOp<'attrSplat'> {
    return ['attrSplat', this.symbols.allocateBlock('attrs')];
  }

  get(op: [InVariable, string[]]): OutOp<'get' | 'maybeLocal' | 'freeVariable'> {
    let [name, rest] = op;

    if (name === 0) {
      return ['get', [0, rest]];
    }

    if (isLocal(name, this.symbols)) {
      let head = this.symbols.get(name);
      return ['get', [head, rest]];
    } else if (name[0] === '@') {
      let head = this.symbols.allocateNamed(name);
      return ['get', [head, rest]];
    } else if (this.strict) {
      return ['freeVariable', [name, ...rest]];
    } else {
      return ['maybeLocal', [name, ...rest]];
    }
  }

  maybeGet(op: [InVariable, string[]]): OutOp<'get' | 'unknown' | 'maybeLocal'> {
    let [name, rest] = op;

    if (name === 0) {
      return ['get', [0, rest]];
    }

    if (isLocal(name, this.symbols)) {
      let head = this.symbols.get(name);
      return ['get', [head, rest]];
    } else if (name[0] === '@') {
      let head = this.symbols.allocateNamed(name);
      return ['get', [head, rest]];
    } else if (rest.length === 0) {
      return ['unknown', name];
    } else {
      return ['maybeLocal', [name, ...rest]];
    }
  }

  yield(op: InVariable): OutOp<'yield'> {
    if (op === 0) {
      throw new Error('Cannot yield to this');
    }

    return ['yield', this.symbols.allocateBlock(op)];
  }

  debugger(_op: Option<InVariable[]>): OutOp<'debugger'> {
    return ['debugger', this.symbols.getEvalInfo()];
  }

  hasBlock(op: InVariable): OutOp<'hasBlock'> {
    if (op === 0) {
      throw new Error('Cannot hasBlock this');
    }

    return ['hasBlock', this.symbols.allocateBlock(op)];
  }

  hasBlockParams(op: InVariable): OutOp<'hasBlockParams'> {
    if (op === 0) {
      throw new Error('Cannot hasBlockParams this');
    }

    return ['hasBlockParams', this.symbols.allocateBlock(op)];
  }

  partial(_op: Option<InVariable[]>): OutOp<'partial'> {
    return ['partial', this.symbols.getEvalInfo()];
  }

  text(_op: string) {}
  comment(_op: string) {}
  openComponent(_op: AST.ElementNode) {}
  openElement(_op: AST.ElementNode) {}
  openSplattedElement(_op: AST.ElementNode) {}
  staticArg(_op: string) {}
  dynamicArg(_op: string) {}
  staticAttr(_op: [string, Option<string>]) {}
  trustingAttr(_op: [string, Option<string>]) {}
  dynamicAttr(_op: [string, Option<string>]) {}
  componentAttr(_op: [string, Option<string>]) {}
  trustingComponentAttr(_op: [string, Option<string>]) {}
  modifier(_op: string) {}
  append(_op: boolean) {}
  block(_op: [string, number, Option<number>]) {}
  literal(_op: string | boolean | number | null | undefined) {}
  helper(_op: string) {}
  unknown(_op: string) {}
  maybeLocal(_op: string[]) {}
  freeVariable(_op: string[]) {}
  prepareArray(_op: number) {}
  prepareObject(_op: number) {}
  concat(_op: null) {}
}

function isLocal(name: string, symbols: AST.Symbols): boolean {
  return symbols && symbols.has(name);
}
