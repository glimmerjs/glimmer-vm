import type {
  BlockSymbolTable,
  BuilderOp,
  CompilableBlock,
  CompilableProgram,
  CompilableTemplate,
  CompileTimeCompilationContext,
  BlockMetadata,
  HandleResult,
  HighLevelOp,
  LayoutWithContext,
  Nullable,
  SerializedBlock,
  SerializedInlineBlock,
  Statement,
  SymbolTable,
  WireFormat,
} from '@glimmer/interfaces';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { EMPTY_ARRAY, IS_COMPILABLE_TEMPLATE } from '@glimmer/util';

import { debugCompiler } from './compiler';
import { templateCompilationContext } from './opcode-builder/context';
import { encodeOp } from './opcode-builder/encoder';
import { meta } from './opcode-builder/helpers/shared';
import { definePushOp, type HighLevelStatementOp } from './syntax/compilers';
import { STATEMENTS } from './syntax/statements';

export const PLACEHOLDER_HANDLE = -1;

class CompilableTemplateImpl<S extends SymbolTable> implements CompilableTemplate<S> {
  compiled: Nullable<HandleResult> = null;
  readonly [IS_COMPILABLE_TEMPLATE] = true;

  constructor(
    readonly statements: WireFormat.Statement[],
    readonly meta: BlockMetadata,
    // Part of CompilableTemplate
    readonly symbolTable: S,
    // Used for debugging
    readonly moduleName = 'plain block'
  ) {}

  // Part of CompilableTemplate
  compile(context: CompileTimeCompilationContext): HandleResult {
    return maybeCompile(this, context);
  }
}

export function isCompilable(value: unknown): value is CompilableTemplate {
  return !!(value && value instanceof CompilableTemplateImpl);
}

export function compilable(layout: LayoutWithContext, moduleName: string): CompilableProgram {
  let [statements, symbols, hasDebug] = layout.block;
  return new CompilableTemplateImpl(
    statements,
    meta(layout),
    {
      symbols,
      hasDebug,
    },
    moduleName
  );
}

function maybeCompile(
  compilable: CompilableTemplateImpl<SymbolTable>,
  context: CompileTimeCompilationContext
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
  syntaxContext: CompileTimeCompilationContext
): HandleResult {
  let sCompiler = STATEMENTS;
  let context = templateCompilationContext(syntaxContext, meta);

  let {
    encoder,
    program: { constants, resolver },
  } = context;

  function pushOp(...op: BuilderOp | HighLevelOp | HighLevelStatementOp) {
    encodeOp(encoder, constants, resolver, meta, op as BuilderOp | HighLevelOp);
  }

  const op = definePushOp(pushOp);

  for (const statement of statements) {
    sCompiler.compile(op, statement);
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
