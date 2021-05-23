import { Dict, CapturedArguments, Source } from '@glimmer/interfaces';
import { createCache } from '@glimmer/validator';
import { reifyPositional, reifyNamed } from '@glimmer/runtime';

export type UserHelper = (args: ReadonlyArray<unknown>, named: Dict<unknown>) => unknown;

export function createHelper(helper: UserHelper, args: CapturedArguments): Source {
  return createCache(() => helper(reifyPositional(args.positional), reifyNamed(args.named)));
}
