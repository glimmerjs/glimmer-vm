import { initializeGuid, ListSlice } from "@glimmer/util";
import { Option } from "@glimmer/interfaces";
import { Tag } from "@glimmer/reference";
import { UpdatingVM } from './vm';

export abstract class AbstractOpcode {
  public type: string;
  public _guid: number;

  constructor() {
    initializeGuid(this);
  }
}

export abstract class UpdatingOpcode extends AbstractOpcode {
  public abstract tag: Tag;

  next: Option<UpdatingOpcode> = null;
  prev: Option<UpdatingOpcode> = null;

  abstract evaluate(vm: UpdatingVM): void;
}

export type UpdatingOpSeq = ListSlice<UpdatingOpcode>;
