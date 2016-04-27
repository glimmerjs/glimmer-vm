import {
  StatementCompilationBuffer,
  Statement as StatementSyntax
} from '../../syntax';

import * as Syntax from '../core';

import {
  EnterOpcode,
  LabelOpcode,
  PutArgsOpcode,
  JumpOpcode,
  JumpUnlessOpcode,
  EvaluateOpcode,
  ExitOpcode,
  PushChildScopeOpcode,
  PopScopeOpcode
} from '../../compiled/opcodes/vm';

import {
  PutIteratorOpcode,
  EnterListOpcode,
  NextIterOpcode,
  EnterWithKeyOpcode,
  ExitListOpcode
} from '../../compiled/opcodes/lists';

import OpcodeBuilderDSL from '../../compiled/opcodes/builder';

import Environment from '../../environment';

export default class EachSyntax extends StatementSyntax {
  type = "each-statement";

  public args: Syntax.Args;
  public templates: Syntax.Templates;
  public isStatic = false;

  constructor({ args, templates }: { args: Syntax.Args, templates: Syntax.Templates }) {
    super();
    this.args = args;
    this.templates = templates;
  }

  prettyPrint() {
    return `#each ${this.args.prettyPrint()}`;
  }

  compile(dsl: OpcodeBuilderDSL, env: Environment) {
    //         Enter(BEGIN, END)
    // BEGIN:  Noop
    //         PutArgs
    //         PutIterable
    //         JumpUnless(ELSE)
    //         EnterList(BEGIN2, END2)
    // ITER:   Noop
    //         NextIter(BREAK)
    //         EnterWithKey(BEGIN2, END2)
    // BEGIN2: Noop
    //         PushChildScope
    //         Evaluate(default)
    //         PopScope
    // END2:   Noop
    //         Exit
    //         Jump(ITER)
    // BREAK:  Noop
    //         ExitList
    //         Jump(END)
    // ELSE:   Noop
    //         Evalulate(inverse)
    // END:    Noop
    //         Exit

    let { args, templates } = this;

    let BEGIN = dsl.label({ label: "BEGIN" });
    let ITER = dsl.label({ label: "ITER" });
    let BEGIN2 = dsl.label({ label: "BEGIN2" });
    let END2 = dsl.label({ label: "END2" });
    let BREAK = dsl.label({ label: "BREAK" });
    let ELSE = dsl.label({ label: "ELSE" });
    let END = dsl.label({ label: "END" });

    dsl.enter({ begin: BEGIN, end: END });
    dsl.append(BEGIN);
    dsl.putArgs({ args });
    dsl.putIterator();

    if (templates.inverse) {
      dsl.jumpUnless({ target: ELSE });
    } else {
      dsl.jumpUnless({ target: END });
    }

    dsl.enterList({ start: BEGIN2, end: END2 });
    dsl.append(ITER);
    dsl.nextIter({ end: BREAK });
    dsl.enterWithKey({ start: BEGIN2, end: END2 });
    dsl.append(BEGIN2);
    dsl.pushChildScope();
    dsl.evaluate({ debug: "default", block: this.templates.default });
    dsl.popScope();
    dsl.append(END2);
    dsl.exit()
    dsl.jump({ target: ITER });
    dsl.append(BREAK);
    dsl.exitList();
    dsl.jump({ target: END });

    if (templates.inverse) {
      dsl.append(ELSE);
      dsl.evaluate({ debug: "inverse", block: this.templates.inverse });
    }

    dsl.append(END);
    dsl.exit();
  }
}
