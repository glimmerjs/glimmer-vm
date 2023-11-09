import type { BuilderOp } from '@glimmer/interfaces';

import type { PushStatementOp } from '../../syntax/compilers';

export function Debug(op: PushStatementOp, ...perform: BuilderOp): void {
  if (import.meta.env.DEV) {
    op(...perform);
  }
}
