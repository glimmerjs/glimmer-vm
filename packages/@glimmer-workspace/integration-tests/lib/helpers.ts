import type { CapturedArguments, Dict } from '@glimmer/interfaces';
import type { Reactive } from '@glimmer/reference';
import { Formula } from '@glimmer/reference';
import { reifyNamed, reifyPositional } from '@glimmer/runtime';

export type UserHelper = (args: ReadonlyArray<unknown>, named: Dict<unknown>) => unknown;

export function createHelperRef(helper: UserHelper, args: CapturedArguments): Reactive {
  return Formula(() => helper(reifyPositional(args.positional), reifyNamed(args.named)));
}
