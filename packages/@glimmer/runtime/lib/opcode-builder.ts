import { VersionedPathReference } from '@glimmer/reference';
import { BrandedComponentDefinition } from './component/interfaces';
import { IArguments } from './vm/arguments';

import {
  Option
} from '@glimmer/util';

import * as WireFormat from '@glimmer/wire-format';

import { RuntimeResolver } from '@glimmer/interfaces';
import { PublicVM } from './vm/append';

export type DynamicComponentDefinition<Specifier> = (
    vm: PublicVM,
    args: IArguments,
    meta: WireFormat.TemplateMeta,
    resolver: RuntimeResolver<Specifier>
  ) => VersionedPathReference<Option<BrandedComponentDefinition>>;
