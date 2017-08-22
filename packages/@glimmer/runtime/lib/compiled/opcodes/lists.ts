import { Op } from '@glimmer/vm';
import { Opaque } from '@glimmer/interfaces';
import {
  IterationArtifacts,
  Reference,
  ReferenceIterator,
  Tag,
  VersionedPathReference,
} from '@glimmer/reference';
import { VM } from '../../vm';
import { Opcode } from '../../environment';

export const LIST_MAPPINGS = {};

class IterablePresenceReference implements Reference<boolean> {
  public tag: Tag;
  private artifacts: IterationArtifacts;

  constructor(artifacts: IterationArtifacts) {
    this.tag = artifacts.tag;
    this.artifacts = artifacts;
  }

  value(): boolean {
    return !this.artifacts.isEmpty();
  }
}

export function PutIterator(vm: VM) {
  let stack = vm.stack;
  let listRef = stack.pop<VersionedPathReference<Opaque>>();
  let key = stack.pop<VersionedPathReference<string>>();
  let iterable = vm.env.iterableFor(listRef, key.value());
  let iterator = new ReferenceIterator(iterable);

  stack.push(iterator);
  stack.push(new IterablePresenceReference(iterator.artifacts));
}

LIST_MAPPINGS[Op.PutIterator] = PutIterator;

export function EnterList(vm: VM, { op1: relativeStart }: Opcode) {
  vm.enterList(relativeStart);
}

LIST_MAPPINGS[Op.EnterList] = EnterList;

export function ExitList(vm: VM) { vm.exitList(); }

LIST_MAPPINGS[Op.ExitList] = ExitList;

export function Iterate(vm: VM, { op1: breaks }: Opcode) {
  let stack = vm.stack;
  let item = stack.peek<ReferenceIterator>().next();

  if (item) {
    let tryOpcode = vm.iterate(item.memo, item.value);
    vm.enterItem(item.key, tryOpcode);
  } else {
    vm.goto(breaks);
  }
}

LIST_MAPPINGS[Op.Iterate] = Iterate;
