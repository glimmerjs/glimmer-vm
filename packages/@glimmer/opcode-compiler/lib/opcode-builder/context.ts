import type {
  BlockMetadata,
  CompileTimeArtifacts,
  CompileTimeResolver,
  CreateRuntimeOp,
  JitContext,
  TemplateCompilationContext,
} from '@glimmer/interfaces';

import { CompileTimeCompilationContextImpl } from '../program-context';
import { EncoderImpl } from './encoder';

export function programCompilationContext(
  artifacts: CompileTimeArtifacts,
  resolver: CompileTimeResolver,
  createOp: CreateRuntimeOp
): JitContext {
  return new CompileTimeCompilationContextImpl(artifacts, resolver, createOp);
}

export function templateCompilationContext(
  program: JitContext,
  meta: BlockMetadata
): TemplateCompilationContext {
  let encoder = new EncoderImpl(program.heap, meta, program.stdlib);

  return {
    program,
    encoder,
    meta,
  };
}
