import { VM } from "../vm";
import { Assert } from "./opcodes/vm";
import { Reference, isConst, ReferenceCache } from "@glimmer/reference";

export function maybeConst<V>(vm: VM, ref: Reference<V>): V {
  if (isConst(ref)) {
    return ref.value();
  } else {
    let cache = new ReferenceCache(ref);
    let val = cache.peek();
    vm.updateWith(new Assert(cache));
    return val;
  }
}
