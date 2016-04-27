import {
  CompileInto,
  SymbolLookup,
  Statement as StatementSyntax
} from '../../syntax';

import * as Syntax from '../core';

import {
  LabelOpcode,
  EnterOpcode,
  PutArgsOpcode,
  TestOpcode,
  JumpUnlessOpcode,
  JumpOpcode,
  EvaluateOpcode,
  ExitOpcode
} from '../../compiled/opcodes/vm';

import OpcodeBuilderDSL from '../../compiled/opcodes/builder'

import Environment from '../../environment';

export default class IfSyntax extends StatementSyntax {
  type = "if-statement";

  public args: Syntax.Args;
  public templates: Syntax.Templates;
  public isStatic = false;

  constructor({ args, templates }: { args: Syntax.Args, templates: Syntax.Templates }) {
    super();
    this.args = args;
    this.templates = templates;
  }

  prettyPrint() {
    return `#if ${this.args.prettyPrint()}`;
  }

  compile(dsl: OpcodeBuilderDSL) {
    //        Enter(BEGIN, END)
    // BEGIN: Noop
    //        PutArgs
    //        Test
    //        JumpUnless(ELSE)
    //        Evaluate(default)
    //        Jump(END)
    // ELSE:  Noop
    //        Evalulate(inverse)
    // END:   Noop
    //        Exit

    let { args } = this;

    let BEGIN = dsl.label({ label: 'BEGIN' });
    let ELSE = dsl.label({ label: 'ELSE' });
    let END = dsl.label({ label: 'END' });

    dsl.enter({ begin: BEGIN, end: END });
    dsl.append(BEGIN);
    dsl.putArgs({ args });
    dsl.test();

    if (this.templates.inverse) {
      dsl.jumpUnless({ target: ELSE });
      dsl.evaluate({ debug: "default", block: this.templates.default });
      dsl.jump({ target: END });
      dsl.append(ELSE);
      dsl.evaluate({ debug: "inverse", block: this.templates.inverse })
    } else {
      dsl.jumpUnless({ target: END });
      dsl.evaluate({ debug: "default", block: this.templates.default });
    }

    dsl.append(END);
    dsl.exit();
  }
}