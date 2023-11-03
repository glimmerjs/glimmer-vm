import type { CapturedArguments, Dict } from '@glimmer/interfaces';
import { FallibleFormula, type SomeReactive } from '@glimmer/reference';
import { reifyNamed, reifyPositional } from '@glimmer/runtime';

export type UserHelper = (args: ReadonlyArray<unknown>, named: Dict<unknown>) => unknown;

export function createHelperRef(helper: UserHelper, args: CapturedArguments): SomeReactive {
  return FallibleFormula(() => helper(reifyPositional(args.positional), reifyNamed(args.named)));
}
