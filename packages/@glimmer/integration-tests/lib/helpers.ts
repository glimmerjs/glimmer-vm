import { Dict, CapturedArguments } from '@glimmer/interfaces';
import { createComputeRef } from '@glimmer/reference';
import { reifyPositional, reifyNamed } from '@glimmer/runtime';

export type UserHelper = (args: ReadonlyArray<unknown>, named: Dict<unknown>) => unknown;

export function createHelperRef(helper: UserHelper, args: CapturedArguments) {
  return createComputeRef(() => helper(reifyPositional(args.positional), reifyNamed(args.named)));
}
