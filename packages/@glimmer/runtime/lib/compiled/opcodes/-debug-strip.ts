import {
  CheckBlockSymbolTable,
  Checker,
  CheckFunction,
  CheckHandle,
  CheckInstanceof,
  CheckInterface,
  CheckNumber,
  CheckProgramSymbolTable,
  CheckUnknown,
  wrap,
  CheckOption,
  CheckOr,
  CheckArray,
  CheckDict,
  CheckObject,
  CheckString,
} from '@glimmer/debug';
import {
  CompilableBlock,
  ComponentDefinition,
  InternalComponentManager,
  ElementOperations,
  Invocation,
  Scope,
  Helper,
  CapturedArguments,
  Option,
  ScopeBlock,
  CompilableProgram,
  ComponentInstance,
  Source,
} from '@glimmer/interfaces';
import { OpaqueIterator, UNDEFINED_SOURCE } from '@glimmer/reference';
import { isSourceImpl } from '@glimmer/validator';
import { PartialScopeImpl } from '../../scope';
import { VMArgumentsImpl } from '../../vm/arguments';
import { ComponentElementOperations } from './component';

export const CheckOperations: Checker<Option<ComponentElementOperations>> = wrap(() =>
  CheckOption(CheckInstanceof(ComponentElementOperations))
);

class SourceChecker {
  type!: Source;

  validate(value: unknown): value is Source {
    return isSourceImpl(value);
  }

  expected(): string {
    return `Source`;
  }
}

export const CheckSource: Checker<Source> = new SourceChecker();

export const CheckIterator: Checker<OpaqueIterator> = CheckInterface({
  next: CheckFunction,
  isEmpty: CheckFunction,
});

export const CheckArguments: Checker<VMArgumentsImpl> = wrap(() =>
  CheckInstanceof(VMArgumentsImpl)
);

export const CheckHelper: Checker<Helper> = CheckFunction as Checker<Helper>;

export class UndefinedSourceChecker implements Checker<Source> {
  type!: Source;

  validate(value: unknown): value is Source {
    return value === UNDEFINED_SOURCE;
  }

  expected(): string {
    return `undefined`;
  }
}

export const CheckUndefinedSource = new UndefinedSourceChecker();

export const CheckCapturedArguments: Checker<CapturedArguments> = CheckInterface({
  positional: wrap(() => CheckArray(CheckSource)),
  named: wrap(() => CheckDict(CheckSource)),
});

export const CheckScope: Checker<Scope> = wrap(() => CheckInstanceof(PartialScopeImpl));

export const CheckComponentManager: Checker<InternalComponentManager<unknown>> = CheckInterface({
  getCapabilities: CheckFunction,
});

export const CheckComponentInstance: Checker<ComponentInstance> = CheckInterface({
  definition: CheckUnknown,
  state: CheckUnknown,
  handle: CheckUnknown,
  table: CheckUnknown,
});

export const CheckCurriedComponentDefinition = CheckOr(CheckObject, CheckFunction);

export const CheckInvocation: Checker<Invocation> = CheckInterface({
  handle: CheckNumber,
  symbolTable: CheckProgramSymbolTable,
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
  resolvedName: CheckOption(CheckString),
  handle: CheckNumber,
  state: CheckOr(CheckObject, CheckFunction),
  manager: CheckComponentManager,
  capabilities: CheckNumber,
  compilable: CheckCompilableProgram,
});
