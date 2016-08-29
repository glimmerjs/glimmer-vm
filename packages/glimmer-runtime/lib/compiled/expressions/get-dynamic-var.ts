import VM from '../../vm/append';
import { CompiledExpression } from '../expressions';
import { UNDEFINED_REFERENCE } from '../../references';
import { Opaque } from 'glimmer-util';
import { PathReference } from 'glimmer-reference';

export default class CompiledGetDynamicVar extends CompiledExpression<any> {
  public type = "get-dynamic-var";
  public varName: string;

  constructor({ varName }: { varName: string }) {
    super();
    this.varName = varName;
  }

  evaluate(vm: VM): PathReference<Opaque> {
    let scope = vm.dynamicScope();
    if (scope.hasOwnProperty(this.varName)) {
      return scope[this.varName];
    } else {
      return UNDEFINED_REFERENCE;
    }
  }

  toJSON(): string {
    return `get-dynamic-var(${this.varName})`;
  }
}
