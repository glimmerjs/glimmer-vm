import { GetContextualFreeOp, SexpOpcodes } from '@glimmer/interfaces';
import { BaseNode, BaseNodeOptions } from './base';
import { SourceSlice } from './internal';

export abstract class ReferenceNode extends BaseNode {}

export class ThisReference extends ReferenceNode {
  readonly type = 'ThisReference';
}

export class ArgReference extends ReferenceNode {
  readonly type = 'ArgReference';
  readonly name: SourceSlice;

  constructor(options: BaseNodeOptions & { name: SourceSlice }) {
    super(options);
    this.name = options.name;
  }
}

export class LocalVarReference extends ReferenceNode {
  readonly type = 'LocalVarReference';
  readonly name: string;

  constructor(options: BaseNodeOptions & { name: string }) {
    super(options);
    this.name = options.name;
  }
}

export class FreeVarReference extends ReferenceNode {
  readonly type = 'FreeVarReference';
  readonly name: SourceSlice;
  readonly context: FreeVarResolution;

  constructor(options: BaseNodeOptions & { name: SourceSlice; context: FreeVarResolution }) {
    super(options);
    this.name = options.name;
    this.context = options.context;
  }
}

// Utilities

export const enum FreeVarNamespace {
  Helper,
  Block,
  Modifier,
  Component,
}

export class NamespacedVarResolution {
  constructor(readonly namespace: FreeVarNamespace) {}

  resolution(): GetContextualFreeOp {
    switch (this.namespace) {
      case FreeVarNamespace.Helper:
        return SexpOpcodes.GetFreeAsCallHead;
      case FreeVarNamespace.Block:
        return SexpOpcodes.GetFreeAsBlockHead;
      case FreeVarNamespace.Modifier:
        return SexpOpcodes.GetFreeAsModifierHead;
      case FreeVarNamespace.Component:
        return SexpOpcodes.GetFreeAsComponentHead;
    }
  }
}

export class StrictResolution {
  resolution(): GetContextualFreeOp {
    return SexpOpcodes.GetStrictFree;
  }
}

export const STRICT_RESOLUTION = new StrictResolution();

export class LooseFreeVariableResolution {
  resolution(): GetContextualFreeOp {
    return SexpOpcodes.GetFreeAsThisFallback;
  }
}

export const LOOSE_FREE_VAR_RESOLUTION = new LooseFreeVariableResolution();

export const enum Ambiguity {
  Append,
  AppendInvoke,
  Attr,
}

export class AmbiguousResolution {
  constructor(readonly ambiguity: Ambiguity) {}

  resolution(): GetContextualFreeOp {
    switch (this.ambiguity) {
      case Ambiguity.Append:
        return SexpOpcodes.GetFreeAsComponentOrHelperHeadOrThisFallback;
      case Ambiguity.AppendInvoke:
        return SexpOpcodes.GetFreeAsComponentOrHelperHead;
      case Ambiguity.Attr:
        return SexpOpcodes.GetFreeAsHelperHeadOrThisFallback;
    }
  }
}

export type FreeVarResolution =
  | NamespacedVarResolution
  | StrictResolution
  | LooseFreeVariableResolution
  | AmbiguousResolution;

export function isFreeVarResolution(value: object): value is FreeVarResolution {
  return (
    value instanceof NamespacedVarResolution ||
    value instanceof StrictResolution ||
    value instanceof LooseFreeVariableResolution ||
    value instanceof AmbiguousResolution
  );
}
