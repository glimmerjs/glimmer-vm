import {
  Statement as StatementSyntax
} from '../../syntax';

import OpcodeBuilderDSL from '../../compiled/opcodes/builder';
import * as Syntax from '../core';
import Environment from '../../environment';
import { default as VM } from '../../vm/append';
import { DynamicScope } from '../../environment';
import { EvaluatedArgs } from '../../compiled/expressions/args';

export default class WithDynamicVarSyntax extends StatementSyntax {
  type = "with-dynamic-var-statement";

  public args: Syntax.Args;
  public templates: Syntax.Templates;
  public isStatic = false;

  constructor({ args, templates }: { args: Syntax.Args, templates: Syntax.Templates }) {
    super();
    this.args = args;
    this.templates = templates;
  }

  compile(dsl: OpcodeBuilderDSL, env: Environment) {
    let callback = (_vm: VM, _scope: DynamicScope) => {
      let vm = _vm as any;
      let scope = _scope as any;

      let args: EvaluatedArgs = vm.frame.getArgs();

      scope[<any>args.positional.values[0].value()] = args.positional.values[1];
    };

    let { args, templates } = this;

    dsl.unit({ templates }, dsl => {
      dsl.putArgs(args);
      dsl.setupDynamicScope(callback);
      dsl.evaluate('default');
      dsl.popDynamicScope();
    });
  }
}
