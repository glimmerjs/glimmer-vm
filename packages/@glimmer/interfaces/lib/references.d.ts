export type ConstantReference = 0;
export type ComputeReference = 1;
export type UnboundReference = 2;
export type InvokableReference = 3;

export interface ReferenceTypes {
  readonly Constant: ConstantReference;
  readonly Compute: ComputeReference;
  readonly Unbound: UnboundReference;
  readonly Invokable: InvokableReference;
}

export type ReferenceType =
  | ConstantReference
  | ComputeReference
  | UnboundReference
  | InvokableReference;

export interface Reference<_T = unknown> {
  /**
   * This is used in Ember
   * @preserve
   */
  debugLabel?: string | undefined;
  _updateChildren_(children: Map<string | Reference, Reference>): void;
}
