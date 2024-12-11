import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/constants';

import type {
  Curry,
  GetDynamicVar,
  HasBlock,
  HasBlockParams,
  IfInline,
  Log,
} from '../../2-encoding/mir';
import type { Keyword, Keywords } from './impl';

import { keywords } from './impl';
import { curryKeyword } from './utils/curry';
import { getDynamicVarKeyword } from './utils/dynamic-vars';
import { hasBlockKeyword } from './utils/has-block';
import { ifUnlessInlineKeyword } from './utils/if-unless';
import { logKeyword } from './utils/log';

export const CALL_KEYWORDS: Keywords<
  'Call',
  Keyword<'Call', HasBlock | HasBlockParams | GetDynamicVar | Log | IfInline | Curry>
> = keywords('Call')
  .kw('has-block', hasBlockKeyword('has-block'))
  .kw('has-block-params', hasBlockKeyword('has-block-params'))
  .kw('-get-dynamic-var', getDynamicVarKeyword)
  .kw('log', logKeyword)
  .kw('if', ifUnlessInlineKeyword('if'))
  .kw('unless', ifUnlessInlineKeyword('unless'))
  .kw('component', curryKeyword(CURRIED_COMPONENT))
  .kw('helper', curryKeyword(CURRIED_HELPER))
  .kw('modifier', curryKeyword(CURRIED_MODIFIER));
