import {
  CheckArray,
  CheckBlockSymbolTable,
  CheckDict,
  type Checker,
  CheckFunction,
  CheckHandle,
  CheckInstanceof,
  CheckInterface,
  CheckNullable,
  CheckNumber,
  CheckObject,
  CheckOr,
  CheckProgramSymbolTable,
  CheckString,
  CheckUnknown,
  WrapCheck,
} from '@glimmer/debug';
import type {
  BlockMetadata,
  CapabilityMask,
  CapturedArguments,
  CompilableBlock,
  CompilableProgram,
  ComponentDefinition,
  ComponentInstance,
  ElementOperations,
  Helper,
  InternalComponentManager,
  Invocation,
  Nullable,
  Scope,
  ScopeBlock,
} from '@glimmer/interfaces';
import {
  type OpaqueIterator,
  REFERENCE,
  type SomeReactive,
  UNDEFINED_REFERENCE,
} from '@glimmer/reference';
import { COMPUTE, type Tag } from '@glimmer/validator';

import { PartialScopeImpl } from '../../scope';
import { VMArgumentsImpl } from '../../vm/arguments';
import { ComponentElementOperations } from './component';

export const CheckTag: Checker<Tag> = CheckInterface({
  [COMPUTE]: CheckFunction,
});

export const CheckOperations: Checker<Nullable<ComponentElementOperations>> = WrapCheck(() =>
  CheckNullable(CheckInstanceof(ComponentElementOperations))
);

class ReferenceChecker {
  validate(value: unknown): value is SomeReactive {
    return typeof value === 'object' || value !== null || REFERENCE in value;
  }

  expected(): string {
    return `Reference`;
  }
}

export const CheckReactive = new ReferenceChecker() as Checker<SomeReactive>;

export const CheckIterator: Checker<OpaqueIterator> = CheckInterface({
  next: CheckFunction,
  isEmpty: CheckFunction,
});

export const CheckArguments: Checker<VMArgumentsImpl> = WrapCheck(() =>
  CheckInstanceof(VMArgumentsImpl)
);

export const CheckHelper: Checker<Helper> = CheckFunction as Checker<Helper>;

export class UndefinedReferenceChecker implements Checker<SomeReactive> {
  declare type: SomeReactive;

  validate(value: unknown): value is SomeReactive {
    return value === UNDEFINED_REFERENCE;
  }

  expected(): string {
    return `undefined`;
  }
}

export const CheckUndefinedReference = new UndefinedReferenceChecker();

export const CheckCapturedArguments: Checker<CapturedArguments> = CheckInterface({
  positional: WrapCheck(() => CheckArray(CheckReactive)),
  named: WrapCheck(() => CheckDict(CheckReactive)),
});

export const CheckScope: Checker<Scope> = WrapCheck(() => CheckInstanceof(PartialScopeImpl));

export const CheckComponentManager: Checker<InternalComponentManager<unknown>> = CheckInterface({
  getCapabilities: CheckFunction,
});

export const CheckCapabilities: Checker<CapabilityMask> = CheckNumber as Checker<CapabilityMask>;

export const CheckComponentInstance: Checker<ComponentInstance> = CheckInterface({
  definition: CheckUnknown,
  state: CheckUnknown,
  handle: CheckUnknown,
  table: CheckUnknown,
});

export const CheckCurriedComponentDefinition = CheckOr(CheckObject, CheckFunction);

export const CheckContainingMetadata: Checker<BlockMetadata> = CheckInterface({
  debugSymbols: CheckNullable(CheckArray(CheckString)),
  moduleName: CheckString,
});

export const CheckInvocation: Checker<Invocation> = CheckInterface({
  handle: CheckNumber,
  symbolTable: CheckProgramSymbolTable,
  meta: CheckNullable(CheckContainingMetadata),
});

export const CheckElementOperations: Checker<ElementOperations> = CheckInterface({
  setAttribute: CheckFunction,
});

export const CheckFinishedComponentInstance: Checker<ComponentInstance> = CheckInterface({
  definition: CheckUnknown,
  state: CheckUnknown,
  handle: CheckHandle,
  table: CheckProgramSymbolTable,
});

export const CheckCompilableBlock: Checker<CompilableBlock> = CheckInterface({
  compile: CheckFunction,
  symbolTable: CheckBlockSymbolTable,
});

export const CheckCompilableProgram: Checker<CompilableProgram> = CheckInterface({
  compile: CheckFunction,
  symbolTable: CheckProgramSymbolTable,
});

export const CheckScopeBlock: Checker<ScopeBlock> = CheckInterface({
  0: CheckCompilableBlock,
  1: CheckScope,
  2: CheckBlockSymbolTable,
});

export const CheckComponentDefinition: Checker<ComponentDefinition> = CheckInterface({
  resolvedName: CheckNullable(CheckString),
  handle: CheckNumber,
  state: CheckOr(CheckObject, CheckFunction),
  manager: CheckComponentManager,
  capabilities: CheckCapabilities,
  compilable: CheckCompilableProgram,
});
