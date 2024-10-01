import type { CompileTimeArtifacts, RuntimeArtifacts } from '@glimmer/interfaces';

import { ConstantsImpl } from './constants';
import { HeapImpl } from './program';

export type SharedArtifacts = CompileTimeArtifacts & RuntimeArtifacts;

export function artifacts(): SharedArtifacts {
  return {
    constants: new ConstantsImpl(),
    heap: new HeapImpl(),
  };
}
