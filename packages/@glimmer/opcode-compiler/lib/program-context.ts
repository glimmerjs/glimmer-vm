import type {
  CompileTimeArtifacts,
  CompileTimeCompilationContext,
  CompileTimeConstants,
  CompileTimeHeap,
  CompileTimeResolver,
  CreateRuntimeOp,
  ResolutionTimeConstants,
  STDLibrary,
} from "@glimmer/interfaces";

import { compileStd } from './opcode-builder/helpers/stdlib';

export class CompileTimeCompilationContextImpl implements CompileTimeCompilationContext {
  readonly constants: CompileTimeConstants & ResolutionTimeConstants;
  readonly heap: CompileTimeHeap;
  readonly stdlib: STDLibrary;

  constructor(
    { constants, heap }: CompileTimeArtifacts,
    readonly resolver: CompileTimeResolver,
    readonly createOp: CreateRuntimeOp
  ) {
    this.constants = constants;
    this.heap = heap;
    this.stdlib = compileStd(this);
  }
}
