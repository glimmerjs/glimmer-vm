import {
  NamedBlocks,
  Optional,
  CompilableBlock,
  WireFormat,
  ContainingMetadata,
  CompileErrorOp,
  Expressions,
  SexpOpcodes,
} from '@glimmer/interfaces';
import { dict, assign } from '@glimmer/util';
import { compilableBlock } from './compilable-template';
import { error } from './opcode-builder/encoder';

interface NamedBlocksDict {
  [key: string]: Optional<CompilableBlock>;
}

export class NamedBlocksImpl implements NamedBlocks {
  public names: string[];

  constructor(private blocks: Optional<NamedBlocksDict>) {
    this.names = blocks ? Object.keys(blocks) : [];
  }

  get(name: string): Optional<CompilableBlock> {
    if (!this.blocks) return null;

    return this.blocks[name] || null;
  }

  has(name: string): boolean {
    let { blocks } = this;
    return blocks !== null && name in blocks;
  }

  with(name: string, block: Optional<CompilableBlock>): NamedBlocks {
    let { blocks } = this;

    if (blocks) {
      return new NamedBlocksImpl(assign({}, blocks, { [name]: block }));
    } else {
      return new NamedBlocksImpl({ [name]: block });
    }
  }

  get hasAny(): boolean {
    return this.blocks !== null;
  }
}

export const EMPTY_BLOCKS = new NamedBlocksImpl(null);

export function namedBlocks(blocks: WireFormat.Core.Blocks, meta: ContainingMetadata): NamedBlocks {
  if (blocks === null) {
    return EMPTY_BLOCKS;
  }

  let out: NamedBlocksDict = dict();

  let [keys, values] = blocks;

  for (let i = 0; i < keys.length; i++) {
    out[keys[i]] = compilableBlock(values[i]!, meta);
  }

  return new NamedBlocksImpl(out);
}

export function isStrictFreeVariable(
  expr: WireFormat.Expression
): expr is WireFormat.Expressions.GetStrictFree {
  return Array.isArray(expr) && expr[0] === SexpOpcodes.GetStrictFree;
}

export function trySloppyFreeVariable(
  expr: WireFormat.Expression,
  meta: ContainingMetadata
): Optional<string> {
  if (!meta.upvars) {
    return null;
  }

  if (!Array.isArray(expr)) {
    return null;
  }

  if (isGet(expr)) {
    return sloppyPathName(expr, meta);
  }

  return null;
}

export function expectSloppyFreeVariable(
  expr: WireFormat.Expression,
  meta: ContainingMetadata,
  desc: string
): string | CompileErrorOp {
  if (!meta.upvars) {
    return error(`${desc}, but there were no free variables in the template`, 0, 0);
  }

  let stringHead = trySloppyFreeVariable(expr, meta);

  if (stringHead === null) {
    throw new Error(`${desc}, got ${JSON.stringify(expr)}`);
  } else {
    return stringHead;
  }
}

export function sloppyPathName(
  opcode: Expressions.GetPath | Expressions.GetVar,
  meta: ContainingMetadata
): Optional<string> {
  if (opcode.length === 3) {
    return null;
  }

  if (isSloppyGetFree(opcode)) {
    return meta.upvars![opcode[1]];
  }

  return null;
}

export function isGet(
  opcode: Expressions.TupleExpression
): opcode is Expressions.GetVar | Expressions.GetPath {
  return opcode[0] >= SexpOpcodes.GetStart && opcode[0] <= SexpOpcodes.GetEnd;
}

export function isStrictGetFree(
  opcode: Expressions.GetVar | Expressions.GetPath
): opcode is Expressions.GetContextualFree {
  return opcode[0] === SexpOpcodes.GetStrictFree;
}

export function isSloppyGetFree(
  opcode: Expressions.GetVar | Expressions.GetPath
): opcode is Expressions.GetContextualFree {
  return opcode[0] >= SexpOpcodes.GetSloppyFreeStart && opcode[0] <= SexpOpcodes.GetSloppyFreeEnd;
}
