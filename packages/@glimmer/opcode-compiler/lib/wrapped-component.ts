import type {
  BlockMetadata,
  CompilableProgram,
  EvaluationContext,
  HandleResult,
  LayoutWithContext,
  Nullable,
  ProgramSymbolTable,
} from '@glimmer/interfaces';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';

import { debugCompiler } from './compiler';
import { templateCompilationContext } from './opcode-builder/context';
import { EncodeOp } from './opcode-builder/encoder';
import { ATTRS_BLOCK, WrappedComponent } from './opcode-builder/helpers/components';
import { meta } from './opcode-builder/helpers/shared';

export class WrappedBuilder implements CompilableProgram {
  public symbolTable: ProgramSymbolTable;
  public compiled: Nullable<HandleResult> = null;
  private attrsBlockNumber: number;
  readonly meta: BlockMetadata;

  constructor(
    private readonly layout: LayoutWithContext,
    public moduleName: string
  ) {
    let { block } = layout;
    let [, symbols] = block;

    symbols = symbols.slice();

    // ensure ATTRS_BLOCK is always included (only once) in the list of symbols
    let attrsBlockIndex = symbols.indexOf(ATTRS_BLOCK);
    if (attrsBlockIndex === -1) {
      this.attrsBlockNumber = symbols.push(ATTRS_BLOCK);
    } else {
      this.attrsBlockNumber = attrsBlockIndex + 1;
    }

    this.symbolTable = {
      symbols,
    };

    this.meta = meta(layout);
  }

  compile(syntax: EvaluationContext): HandleResult {
    if (this.compiled !== null) return this.compiled;

    let m = meta(this.layout);
    let context = templateCompilationContext(syntax, m);

    let { encoder, evaluation } = context;

    const encode = new EncodeOp(encoder, evaluation, m);

    WrappedComponent(encode, this.layout, this.attrsBlockNumber);

    let handle = context.encoder.commit(m.size);

    if (typeof handle !== 'number') {
      return handle;
    }

    this.compiled = handle;

    if (LOCAL_TRACE_LOGGING) {
      debugCompiler(context, handle);
    }

    return handle;
  }
}
