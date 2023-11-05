import type {
  CompileTimeArtifacts,
  JitContext,
  CompileTimeConstants,
  CompileTimeHeap,
  CompileTimeResolver,
  CreateRuntimeOp,
  DebugConstants,
  ResolutionTimeConstants,
  STDLib,
} from '@glimmer/interfaces';

import { compileStd } from './opcode-builder/helpers/stdlib';

export class CompileTimeCompilationContextImpl implements JitContext {
  readonly constants: CompileTimeConstants & ResolutionTimeConstants & DebugConstants;
  readonly heap: CompileTimeHeap;
  readonly stdlib: STDLib;

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
