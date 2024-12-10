import type {
  ComputeReferenceId,
  ConstantReferenceId,
  InvokableReferenceId,
  UnboundReferenceId,
} from '@glimmer/state';

export interface ReferenceTypes {
  readonly Constant: ConstantReferenceId;
  readonly Compute: ComputeReferenceId;
  readonly Unbound: UnboundReferenceId;
  readonly Invokable: InvokableReferenceId;
}
