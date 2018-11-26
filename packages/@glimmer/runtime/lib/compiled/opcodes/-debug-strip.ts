import {
  Checker,
  CheckInstanceof,
  CheckFunction,
  CheckInterface,
  CheckOpaque,
  CheckBlockSymbolTable,
  CheckProgramSymbolTable,
  CheckHandle,
  wrap,
  CheckNumber,
} from '@glimmer/debug';
import { Tag, TagWrapper, VersionedPathReference, Reference } from '@glimmer/reference';
import {
  ReadonlyArguments,
  ReadonlyCapturedArguments,
  CapturedPositionalArguments,
  CapturedNamedArguments,
  Arguments,
} from '../../vm/arguments';
import { ComponentInstance } from './component';
import { ComponentManager } from '../../internal-interfaces';
import { CompilableBlock, UserValue } from '@glimmer/interfaces';
import { Scope, ScopeImpl } from '../../scope';

export const CheckTag: Checker<Tag> = CheckInstanceof(TagWrapper);

export const CheckPathReference: Checker<VersionedPathReference<UserValue>> = CheckInterface({
  tag: CheckTag,
  value: CheckFunction,
  get: CheckFunction,
});

export const CheckReference: Checker<Reference<UserValue>> = CheckInterface({
  tag: CheckTag,
  value: CheckFunction,
});

export const CheckArguments: Checker<ReadonlyArguments> = wrap(() => CheckInstanceof(Arguments));
export const CheckCapturedArguments: Checker<ReadonlyCapturedArguments> = CheckInterface({
  tag: CheckTag,
  length: CheckNumber,
  positional: CheckInstanceof(CapturedPositionalArguments),
  named: CheckInstanceof(CapturedNamedArguments),
});

export const CheckScope: Checker<Scope> = wrap(() => CheckInstanceof(ScopeImpl));

export const CheckComponentManager: Checker<ComponentManager> = CheckInterface({
  getCapabilities: CheckFunction,
});

export const CheckComponentInstance: Checker<ComponentInstance> = CheckInterface({
  definition: CheckOpaque,
  state: CheckOpaque,
  handle: CheckOpaque,
  table: CheckOpaque,
});

export const CheckFinishedComponentInstance: Checker<ComponentInstance> = CheckInterface({
  definition: CheckOpaque,
  state: CheckOpaque,
  handle: CheckHandle,
  table: CheckProgramSymbolTable,
});

export const CheckCompilableBlock: Checker<CompilableBlock> = CheckInterface({
  compile: CheckFunction,
  symbolTable: CheckBlockSymbolTable,
});
