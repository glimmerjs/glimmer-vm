import { Environment } from './environment';
import { Source } from '../tracking';
import { Destroyable } from '../core';
import { DynamicScope } from './scope';
import { Owner } from './owner';
import { GlimmerTreeChanges } from '../dom/changes';
import { ExceptionHandler } from './render';
/**
 * This is used in the Glimmer Embedding API. In particular, embeddings
 * provide helpers through the `CompileTimeLookup` interface, and the
 * helpers they provide implement the `Helper` interface, which is a
 * function that takes a `VM` as a parameter.
 */
export interface VM<O extends Owner = Owner> {
  env: Environment;
  dynamicScope(): DynamicScope;
  getOwner(): O;
  getSelf(): Source;
  associateDestroyable(child: Destroyable): void;
}

export interface UpdatingVM {
  env: Environment;
  dom: GlimmerTreeChanges;
  alwaysRevalidate: boolean;

  execute(opcodes: UpdatingOpcode[], handler: ExceptionHandler): void;
  goto(index: number): void;
  try(ops: UpdatingOpcode[], handler: ExceptionHandler | null): void;
  throw(): void;
}

export interface UpdatingOpcode {
  evaluate(vm: UpdatingVM): void;
}
