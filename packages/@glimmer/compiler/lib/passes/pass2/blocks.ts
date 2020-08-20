import {
  SerializedInlineBlock,
  SerializedTemplateBlock,
  SexpOpcodes,
  WireFormat as wire,
} from '@glimmer/interfaces';
import { DictSet, isPresent } from '@glimmer/util';
import { SourceSlice } from '../pass1/ops';
import { BlockSymbolTable, ProgramSymbolTable } from '../shared/symbol-table';
import * as out from './out';

export abstract class Block {
  public statements: out.Statement[] = [];

  push(...statements: out.Statement[]) {
    this.statements.push(...statements);
  }

  abstract evalInfo: wire.Core.EvalInfo;
}

export class NamedBlock extends Block {
  constructor(public name: SourceSlice, public table: BlockSymbolTable) {
    super();
  }

  get evalInfo(): wire.Core.EvalInfo {
    return this.table.getEvalInfo();
  }

  encode(): [name: string, block: SerializedInlineBlock] {
    return [
      this.name.getString(),
      {
        statements: this.statements.map(s => s.encode()),
        parameters: this.table.slots,
      },
    ];
  }
}

export class TemplateBlock extends Block {
  public type = 'template';
  public yields = new DictSet<string>();
  public named = new DictSet<string>();
  public blocks: NamedBlock[] = [];

  constructor(private table: ProgramSymbolTable) {
    super();
  }

  get evalInfo(): wire.Core.EvalInfo {
    return this.table.getEvalInfo();
  }

  encode(): SerializedTemplateBlock {
    return {
      symbols: this.table.symbols,
      statements: this.statements.map(s => s.encode()),
      hasEval: this.table.hasEval,
      upvars: this.table.freeVariables,
    };
  }
}

export class ComponentBlock extends Block {
  public attrs: out.ElementParameter[] = [];
  public args: out.Arg[] = [];
  private inParams = true;
  public positionals: number[] = [];
  public blocks: NamedBlock[] = [];

  constructor(
    private tag: out.Expr,
    private table: BlockSymbolTable,
    private selfClosing: boolean
  ) {
    super();
  }

  get evalInfo(): wire.Core.EvalInfo {
    return this.table.getEvalInfo();
  }

  push(...statements: out.Statement[]) {
    for (let statement of statements) {
      if (this.inParams) {
        if (statement.name === 'FlushElement') {
          this.inParams = false;
        } else if (out.isArg(statement)) {
          this.args.push(statement);
        } else if (out.isElementParameter(statement)) {
          this.attrs.push(statement);
        } else {
          throw new Error('Compile Error: only parameters allowed before flush-element');
        }
      } else {
        this.statements.push(statement);
      }
    }
  }

  pushBlock(block: NamedBlock) {
    if (this.selfClosing) {
      throw new Error('Compile Error: self-closing components cannot have blocks');
    }

    this.blocks.push(block);
  }

  encode(): wire.Statements.Component {
    let { args } = this;

    let tag = this.tag.encode();
    let attrs = this.attrs.map(a => a.encode());
    let hash = isPresent(args) ? out.encodeHash(args, arg => arg.encodeHash()) : null;

    let blocks: wire.Core.Blocks;

    if (this.selfClosing) {
      blocks = null;
    } else if (isPresent(this.blocks)) {
      blocks = out.encodeHash(this.blocks, block => {
        let [key, value] = block.encode();
        return [key.slice(1), value];
      });
    } else {
      blocks = [['default'], [this.encodeAsBlock()]];
    }

    return [SexpOpcodes.Component, tag, isPresent(attrs) ? attrs : null, hash, blocks];
  }

  encodeAsBlock(): SerializedInlineBlock {
    return {
      statements: this.statements.map(s => s.encode()),
      parameters: this.table.slots,
    };
  }
}

export class Template {
  public block: TemplateBlock;

  constructor(symbols: ProgramSymbolTable) {
    this.block = new TemplateBlock(symbols);
  }

  encode(): SerializedTemplateBlock {
    return this.block.encode();
  }
}
