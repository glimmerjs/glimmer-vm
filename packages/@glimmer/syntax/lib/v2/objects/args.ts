import { SourceLocation, SYNTHETIC } from '../../source/location';
import { BaseNode, BaseNodeOptions } from './base';
import { Expression } from './expr';
import { SourceSlice } from './internal';

export class Args extends BaseNode {
  static empty(loc: SourceLocation = SYNTHETIC): Args {
    return new Args({ loc, positional: Positional.empty(), named: Named.empty() });
  }

  readonly type = 'Args';
  readonly positional: Positional;
  readonly named: Named;

  constructor(options: BaseNodeOptions & { positional: Positional; named: Named }) {
    super(options);
    this.positional = options.positional;
    this.named = options.named;
  }

  isEmpty(): boolean {
    return this.positional.isEmpty() && this.named.isEmpty();
  }
}

export class Positional extends BaseNode {
  static empty(loc: SourceLocation = SYNTHETIC): Positional {
    return new Positional({
      loc,
      exprs: [],
    });
  }

  readonly type = 'Positional';
  readonly exprs: readonly Expression[];

  constructor(options: BaseNodeOptions & { exprs: readonly Expression[] }) {
    super(options);
    this.exprs = options.exprs;
  }

  isEmpty(): boolean {
    return this.exprs.length === 0;
  }
}

export class Named extends BaseNode {
  static empty(loc: SourceLocation = SYNTHETIC): Named {
    return new Named({
      loc,
      entries: [],
    });
  }

  readonly type = 'Named';
  readonly entries: readonly NamedEntry[];

  constructor(options: BaseNodeOptions & { entries: readonly NamedEntry[] }) {
    super(options);
    this.entries = options.entries;
  }

  isEmpty(): boolean {
    return this.entries.length === 0;
  }
}

export class NamedEntry extends BaseNode {
  readonly type = 'NamedEntry';
  readonly name: SourceSlice;
  readonly value: Expression;

  constructor(options: BaseNodeOptions & { name: SourceSlice; value: Expression }) {
    super(options);
    this.name = options.name;
    this.value = options.value;
  }
}
