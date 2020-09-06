import * as pass2 from '../pass2/ops';

export class ComponentBlock {
  private attrs: pass2.ElementParameter[] = [];
  private args: pass2.Arg[] = [];
  private inParams = true;
  private blocks: pass2.NamedBlock[] = [];
  private statements: pass2.Statement[] = [];

  constructor(private selfClosing: boolean) {}

  push(...statements: pass2.Statement[]): void {
    for (let statement of statements) {
      if (this.inParams) {
        if (isArg(statement)) {
          this.args.push(statement);
        } else if (isElementParameter(statement)) {
          this.attrs.push(statement);
        } else {
          throw new Error('Compile Error: only parameters allowed before flush-element');
        }
      } else {
        this.statements.push(statement);
      }
    }
  }

  pushBlock(block: pass2.NamedBlock): void {
    if (this.selfClosing) {
      throw new Error('Compile Error: self-closing components cannot have blocks');
    }

    this.blocks.push(block);
  }
}

export function isArg(statement: pass2.Statement): statement is pass2.StaticArg | pass2.DynamicArg {
  return statement.name === 'StaticArg' || statement.name === 'DynamicArg';
}

export function isElementParameter(
  statement: pass2.Statement
): statement is pass2.ElementParameter {
  switch (statement.name) {
    case 'StaticSimpleAttr':
    case 'StaticComponentAttr':
    case 'ComponentAttr':
    case 'DynamicSimpleAttr':
    case 'TrustingDynamicAttr':
    case 'TrustingComponentAttr':
    case 'Modifier':
    case 'AttrSplat':
      return true;
    default:
      return false;
  }
}
