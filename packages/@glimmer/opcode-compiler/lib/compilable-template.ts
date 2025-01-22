import type {
  BlockMetadata,
  BlockSymbolTable,
  CompilableBlock,
  CompilableProgram,
  CompilableTemplate,
  EvaluationContext,
  HandleResult,
  LayoutWithContext,
  Nullable,
  SerializedBlock,
  SerializedInlineBlock,
  Statement,
  SymbolTable,
  WireFormat,
} from '@glimmer/interfaces';
import { IS_COMPILABLE_TEMPLATE } from '@glimmer/constants';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { EMPTY_ARRAY } from '@glimmer/util';

import { debugCompiler } from './compiler';
import { templateCompilationContext } from './opcode-builder/context';
import { EncodeOp } from './opcode-builder/encoder';
import { meta } from './opcode-builder/helpers/shared';
import { STATEMENTS } from './syntax/statements';

export const PLACEHOLDER_HANDLE = -1;

class CompilableTemplateImpl<S extends SymbolTable> implements CompilableTemplate<S> {
  static {
    if (LOCAL_TRACE_LOGGING) {
      Reflect.set(this.prototype, IS_COMPILABLE_TEMPLATE, true);
    }
  }

  compiled: Nullable<HandleResult> = null;

  constructor(
    readonly statements: WireFormat.Statement[],
    readonly meta: BlockMetadata,
    // Part of CompilableTemplate
    readonly symbolTable: S,
    // Used for debugging
    readonly moduleName = 'plain block'
  ) {}

  // Part of CompilableTemplate
  compile(context: EvaluationContext): HandleResult {
    return maybeCompile(this, context);
  }
}

export function compilable(layout: LayoutWithContext, moduleName: string): CompilableProgram {
  let [statements, symbols] = layout.block;
  return new CompilableTemplateImpl(
    statements,
    meta(layout),
    {
      symbols,
    },
    moduleName
  );
}

function maybeCompile(
  compilable: CompilableTemplateImpl<SymbolTable>,
  context: EvaluationContext
): HandleResult {
  if (compilable.compiled !== null) return compilable.compiled;

  compilable.compiled = PLACEHOLDER_HANDLE;

  let { statements, meta } = compilable;

  let result = compileStatements(statements, meta, context);
  compilable.compiled = result;

  return result;
}

export function compileStatements(
  statements: Statement[],
  meta: BlockMetadata,
  syntaxContext: EvaluationContext
): HandleResult {
  let sCompiler = STATEMENTS;
  let context = templateCompilationContext(syntaxContext, meta);

  let { encoder, evaluation } = context;

  const encode = new EncodeOp(encoder, evaluation, meta);

  for (const statement of statements) {
    sCompiler.compile(encode, statement);
  }

  let handle = context.encoder.commit(meta.size);

  if (LOCAL_TRACE_LOGGING) {
    debugCompiler(context, handle);
  }

  return handle;
}

export function compilableBlock(
  block: SerializedInlineBlock | SerializedBlock,
  containing: BlockMetadata
): CompilableBlock {
  return new CompilableTemplateImpl<BlockSymbolTable>(block[0], containing, {
    parameters: block[1] || (EMPTY_ARRAY as number[]),
  });
}
