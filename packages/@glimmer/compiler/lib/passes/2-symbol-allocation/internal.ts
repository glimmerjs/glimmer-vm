import { OpArgs } from '../../shared/op';
import * as mir from '../3-encoding/mir';
import { Context, MapVisitorsInterface } from './context';
import * as hir from './hir';

export class Pass1Internal
  implements MapVisitorsInterface<Exclude<hir.Internal, hir.Ignore>, mir.Internal> {
  Positional(ctx: Context, { list }: OpArgs<hir.Positional>): mir.Positional {
    let values = ctx.visitExprs(list);
    return ctx.op(mir.Positional, { list: values });
  }

  Named(ctx: Context, { pairs }: OpArgs<hir.Named>): mir.NamedArguments {
    return ctx.op(mir.NamedArguments, { pairs: pairs.map((pair) => ctx.visitInternal(pair)) });
  }

  NamedEntry(ctx: Context, { key, value }: OpArgs<hir.NamedEntry>): mir.NamedArgument {
    return ctx.op(mir.NamedArgument, { key, value: ctx.visitExpr(value) });
  }

  Args(ctx: Context, args: OpArgs<hir.Args>): mir.Args {
    return ctx.op(mir.Args, {
      positional: ctx.visitInternal(args.positional),
      named: ctx.visitInternal(args.named),
    });
  }

  NamedBlocks(ctx: Context, args: OpArgs<hir.NamedBlocks>): mir.NamedBlocks {
    return ctx.op(mir.NamedBlocks, {
      blocks: args.blocks.map((b) => ctx.visitInternal(b)),
    });
  }

  NamedBlock(
    ctx: Context,
    { name, table: symbols, body: block }: OpArgs<hir.NamedBlock>
  ): mir.NamedBlock {
    return ctx.withBlock(symbols, () => {
      let statements = block.map((e) => ctx.visitStmt(e));
      return ctx.op(mir.NamedBlock, { symbols, name, body: statements });
    });
  }

  ElementParameters(ctx: Context, { body }: OpArgs<hir.ElementParameters>): mir.ElementParameters {
    return ctx.op(mir.ElementParameters, {
      body: body.map((a) => ctx.visitStmt<hir.ElementParameter>(a)),
    });
  }
}

export const INTERNAL = new Pass1Internal();
