import { Unique, Opaque, SymbolTable, Option, BlockSymbolTable, Opcode } from "@glimmer/interfaces";
import { Core, SerializedTemplateBlock, Statements as S, Expression as E } from "@glimmer/wire-format";

export type VMHandle = Unique<"Handle">;

export interface CompileTimeHeap {
  push(name: /* TODO: Op */ number, op1?: number, op2?: number, op3?: number): void;
  malloc(): VMHandle;
  finishMalloc(handle: VMHandle, scopeSize: number): void;

  // for debugging
  getaddr(handle: VMHandle): number;
  sizeof(handle: VMHandle): number;
}

export interface ComponentCapabilities {
  staticDefinitions: boolean;
  dynamicLayout: boolean;
  dynamicTag: boolean;
  prepareArgs: boolean;
  createArgs: boolean;
  attributeHook: boolean;
  elementHook: boolean;
}

export interface Macros {
  blocks: Macro;
  inlines: Macro;
}

export interface Macro {
  add(name: string, func: Opaque): void;
  addMissing(func: Opaque): void;
}

export interface BlockMacro extends Macro {
  compile(name: string, params: Core.Params, hash: Core.Hash, template: Option<CompilableBlock>, inverse: Option<CompilableBlock>, builder: Opaque): void;
}

export interface InlineMacro extends Macro {
  compile(sexp: S.Append, builder: Opaque): ['expr', E] | true;
}

export interface EagerResolver<Specifier> {
  getCapabilities(specifier: Specifier): ComponentCapabilities;
}

export interface EagerCompilationOptions<Specifier, R extends EagerResolver<Specifier>> {
  resolver: R;
  program: CompileTimeProgram;
  macros: Macros;
}

export interface CompilableTemplate<S extends SymbolTable> {
  symbolTable: S;
  compile(): VMHandle;
}

export type CompilableBlock = CompilableTemplate<BlockSymbolTable>;

export interface CompileTimeProgram {
  [key: number]: never;

  constants: CompileTimeConstants;
  heap: CompileTimeHeap;

  opcode(offset: number): Opcode;
}

export type Primitive = undefined | null | boolean | number | string;

export interface CompileTimeConstants {
  string(value: string): number;
  stringArray(strings: string[]): number;
  array(values: number[]): number;
  table(t: SymbolTable): number;
  handle(specifier: Opaque): number;
  serializable(value: Opaque): number;
  float(value: number): number;
}

export interface CompileTimeLazyConstants extends CompileTimeConstants {
  other(value: Opaque): number;
}

export type ComponentArgs = [Core.Params, Core.Hash, Option<CompilableBlock>, Option<CompilableBlock>];
export type Specifier = Opaque;

export interface ComponentBuilder {
  static(definition: number, args: ComponentArgs): void;
}

export interface ParsedLayout<Specifier = Opaque> {
  id?: Option<string>;
  block: SerializedTemplateBlock;
  referer: Specifier;
}
