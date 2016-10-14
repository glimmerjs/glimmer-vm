import {
  Statement as StatementSyntax
} from '../../syntax';

import OpcodeBuilderDSL from '../../compiled/opcodes/builder';
import * as Syntax from '../core';
import Environment from '../../environment';

export default class RenderPortalSyntax extends StatementSyntax {
  type = "render-portal-statement";

  public args: Syntax.Args;
  public templates: Syntax.Templates;
  public isStatic = false;

  constructor({ args, templates }: { args: Syntax.Args, templates: Syntax.Templates }) {
    super();
    this.args = args;
    this.templates = templates;
  }

  compile(dsl: OpcodeBuilderDSL, env: Environment) {
    let { args, templates } = this;

    dsl.block({ templates, args }, (dsl, BEGIN, END) => {
      dsl.putArgs(args);
      dsl.pushRemoteElement();
      dsl.evaluate('default');
      dsl.popRemoteElement();
    });
  }
}
