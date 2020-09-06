import { mapPresent } from '@glimmer/util';
import * as pass1 from '../pass1/ops';
import * as pass2 from '../pass2/ops';
import { OpArgs } from '../shared/op';
import { Context, MapVisitorsInterface } from './context';

export class Pass1Internal
  implements MapVisitorsInterface<Exclude<pass1.Internal, pass1.Ignore>, pass2.Internal> {
  Params(ctx: Context, { list }: OpArgs<pass1.Params>): pass2.Positional {
    let values = ctx.visitExprs(list);
    return ctx.op(pass2.Positional, { list: values });
  }

  EmptyParams(ctx: Context, _: OpArgs<pass1.EmptyParams>): pass2.EmptyPositional {
    return ctx.op(pass2.EmptyPositional);
  }

  NamedArguments(ctx: Context, { pairs }: OpArgs<pass1.NamedArguments>): pass2.AnyNamedArguments {
    if (pairs.length === 0) {
      return ctx.op(pass2.EmptyNamedArguments);
    }

    let mappedPairs = ctx.map(pairs, (pair) => ctx.visitInternal(pair));

    return ctx.op(pass2.NamedArguments, { pairs: mappedPairs });
  }

  EmptyNamedArguments(
    ctx: Context,
    _: OpArgs<pass1.EmptyNamedArguments>
  ): pass2.EmptyNamedArguments {
    return ctx.op(pass2.EmptyNamedArguments);
  }

  NamedArgument(ctx: Context, { key, value }: OpArgs<pass1.NamedArgument>): pass2.NamedArgument {
    return ctx.op(pass2.NamedArgument, { key, value: ctx.visitExpr(value) });
  }

  NamedBlocks(ctx: Context, args: OpArgs<pass1.NamedBlocks>): pass2.NamedBlocks {
    return ctx.op(pass2.NamedBlocks, {
      blocks: mapPresent(args.blocks, (b) => ctx.visitInternal(b)),
    });
  }

  EmptyNamedBlocks(ctx: Context): pass2.EmptyNamedBlocks {
    return ctx.op(pass2.EmptyNamedBlocks);
  }

  NamedBlock(
    ctx: Context,
    { name, table: symbols, body: block }: OpArgs<pass1.NamedBlock>
  ): pass2.NamedBlock {
    return ctx.withBlock(symbols, () => {
      let statements = block.map((e) => ctx.visitStmt(e));
      return ctx.op(pass2.NamedBlock, { symbols, name, body: statements });
    });
  }

  ElementParameters(
    ctx: Context,
    { body }: OpArgs<pass1.ElementParameters>
  ): pass2.ElementParameters {
    return ctx.op(pass2.ElementParameters, {
      body: mapPresent(body, (a) => ctx.visitStmt<pass1.ElementParameter>(a)),
    });
  }

  EmptyElementParameters(ctx: Context): pass2.EmptyElementParameters {
    return ctx.op(pass2.EmptyElementParameters);
  }
}

export const INTERNAL = new Pass1Internal();
