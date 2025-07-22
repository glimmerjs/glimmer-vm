import type { PresentArray } from './array.js';
import type { EncoderError } from './compile/encoder.js';
import type { Operand, SerializedInlineBlock, SerializedTemplateBlock } from './compile/index.js';
import type { Nullable, Optional } from './core.js';
import type { InternalComponentCapabilities } from './managers/internal/component.js';
import type { ConstantPool, EvaluationContext, SerializedHeap } from './program.js';
import type { Owner } from './runtime.js';
import type { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from './tier1/symbol-table.js';

export interface CompilableProgram extends CompilableTemplate<ProgramSymbolTable> {
  moduleName: string;
}

export type CompilableBlock = CompilableTemplate<BlockSymbolTable>;

export interface LayoutWithContext {
  readonly id: string;
  readonly block: SerializedTemplateBlock;
  readonly moduleName: string;
  readonly owner: Owner | null;
  readonly scope: (() => unknown[]) | undefined | null;
  readonly isStrictMode: boolean;
}

export interface BlockWithContext {
  readonly block: SerializedInlineBlock;
  readonly containingLayout: LayoutWithContext;
}

/**
 * Environment specific template.
 */
export interface TemplateOk {
  result: 'ok';

  /**
   * Module name associated with the template, used for debugging purposes
   */
  moduleName: string;

  // internal casts, these are lazily created and cached
  asLayout(): CompilableProgram;
  asWrappedLayout(): CompilableProgram;
}

export interface TemplateError {
  result: 'error';

  problem: string;
  span: {
    start: number;
    end: number;
  };
}

export type Template = TemplateOk | TemplateError;

export type TemplateFactory = (owner?: Owner) => Template;

export interface STDLib {
  main: number;
  'cautious-append': number;
  'trusting-append': number;
  'cautious-non-dynamic-append': number;
  'trusting-non-dynamic-append': number;
  'trusting-dynamic-helper-append': number;
  'cautious-dynamic-helper-append': number;
}

export type SerializedStdlib = [number, number, number];

export type STDLibName = keyof STDLib;

export type CompilerBuffer = Array<Operand>;

export interface ResolvedLayout {
  handle: number;
  capabilities: InternalComponentCapabilities;
  layout: Nullable<CompilableProgram>;
}

export type OkHandle = number;
export interface ErrHandle {
  handle: number;
  errors: PresentArray<EncoderError>;
}

export type HandleResult = OkHandle | ErrHandle;

export interface AbstractNamedBlocks {
  readonly hasAny: boolean;
  readonly names: string[];
  get(name: string): Nullable<SerializedInlineBlock>;
  has(name: string): boolean;
  with(name: string, block: Optional<SerializedInlineBlock>): NamedBlocks;
  remove(name: string): [Optional<SerializedInlineBlock>, NamedBlocks];
}

export interface EmptyNamedBlocks extends AbstractNamedBlocks {
  readonly hasAny: false;
  readonly names: [];
  with(name: string, block: Optional<SerializedInlineBlock>): PresentNamedBlocks;
  remove(name: string): [undefined, EmptyNamedBlocks];
}

export interface PresentNamedBlocks extends AbstractNamedBlocks {
  readonly hasAny: true;
  readonly names: PresentArray<string>;
  with(name: string, block: Optional<SerializedInlineBlock>): PresentNamedBlocks;
  remove(name: string): [Optional<SerializedInlineBlock>, NamedBlocks];
}

export type NamedBlocks = EmptyNamedBlocks | PresentNamedBlocks;

export interface CompilerArtifacts {
  heap: SerializedHeap;
  constants: ConstantPool;
}

export interface CompilableTemplate<S extends SymbolTable = SymbolTable> {
  readonly symbolTable: S;
  readonly meta: BlockMetadata;
  readonly compiled: Nullable<HandleResult>;
  compile(context: EvaluationContext): HandleResult;
}

export interface BlockSymbolNames {
  locals: Nullable<string[]>;
  lexical?: Optional<string[]>;
  upvars: Nullable<string[]>;
}

export interface DebuggerInfo {
  locals: Record<string, number>;
  lexical: Record<string, number>;
  upvars: Record<string, number>;
}

export interface BlockMetadata {
  symbols: BlockSymbolNames;
  scopeValues: unknown[] | null;
  isStrictMode: boolean;
  moduleName: string | undefined;
  owner: Owner | null;
  size: number;
}
