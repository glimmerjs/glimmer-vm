import { Context } from '../pass2/context';
import * as out from '../pass2/out';
import * as shared from './op';
import { OpArgs } from './op';

export type Visitors<
  O extends shared.OpsTable<shared.Op>,
  Out extends out.Op | void = out.Op | void
> = {
  [P in keyof O]: (ctx: Context, args: OpArgs<O[P]>) => Out;
};

export type OpsForVisitor<V extends Visitors<shared.OpsTable<shared.Op>>> = V extends Visitors<
  infer Op
>
  ? Op[keyof Op]
  : never;
