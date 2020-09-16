import { mapPresent } from '@glimmer/util';
import * as hir from './hir';
import * as mir from '../pass2/mir';
import { OpArgs } from '../../shared/op';
import { Context, MapVisitorsInterface } from './context';

export class Pass1Internal
  implements MapVisitorsInterface<Exclude<hir.Internal, hir.Ignore>, mir.Internal> {
  SourceSlice(ctx: Context, args: OpArgs<hir.SourceSlice>): mir.SourceSlice {
    return ctx.op(mir.SourceSlice, args);
  }

  Params(ctx: Context, { list }: OpArgs<hir.Params>): mir.Positional {
    let values = ctx.visitExprs(list);
    return ctx.op(mir.Positional, { list: values });
  }

  NamedArguments(ctx: Context, { pairs }: OpArgs<hir.NamedArguments>): mir.NamedArguments {
    return ctx.op(mir.NamedArguments, { pairs: pairs.map((pair) => ctx.visitInternal(pair)) });
  }

  NamedArgument(ctx: Context, { key, value }: OpArgs<hir.NamedArgument>): mir.NamedArgument {
    return ctx.op(mir.NamedArgument, { key, value: ctx.visitExpr(value) });
  }

  NamedBlocks(ctx: Context, args: OpArgs<hir.NamedBlocks>): mir.NamedBlocks {
    return ctx.op(mir.NamedBlocks, {
      blocks: mapPresent(args.blocks, (b) => ctx.visitInternal(b)),
    });
  }

  EmptyNamedBlocks(ctx: Context): mir.EmptyNamedBlocks {
    return ctx.op(mir.EmptyNamedBlocks);
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
      body: mapPresent(body, (a) => ctx.visitStmt<hir.ElementParameter>(a)),
    });
  }

  EmptyElementParameters(ctx: Context): mir.EmptyElementParameters {
    return ctx.op(mir.EmptyElementParameters);
  }
}

export const INTERNAL = new Pass1Internal();
