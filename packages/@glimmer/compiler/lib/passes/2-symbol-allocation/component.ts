import * as mir from '../3-encoding/mir';

export class ComponentBlock {
  private attrs: mir.ElementParameter[] = [];
  private args: mir.Arg[] = [];
  private inParams = true;
  private blocks: mir.NamedBlock[] = [];
  private statements: mir.Statement[] = [];

  constructor(private selfClosing: boolean) {}

  push(...statements: mir.Statement[]): void {
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

  pushBlock(block: mir.NamedBlock): void {
    if (this.selfClosing) {
      throw new Error('Compile Error: self-closing components cannot have blocks');
    }

    this.blocks.push(block);
  }
}

export function isArg(statement: mir.Statement): statement is mir.StaticArg | mir.DynamicArg {
  return statement.name === 'StaticArg' || statement.name === 'DynamicArg';
}

export function isElementParameter(statement: mir.Statement): statement is mir.ElementParameter {
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
