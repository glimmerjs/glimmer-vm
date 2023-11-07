import type { DebugLabel } from '@glimmer/interfaces';

import { unwrap } from './assert';

export function getDebugLabel(reactive: { debug?: { label: DebugLabel } }): string {
  // if we're in this function, we should be in debug mode.
  const debug = unwrap(reactive.debug);

  const [first, ...rest] = debug.label;

  let out: string = first;

  for (const part of rest) {
    if (typeof part === 'string') {
      if (/^\p{XID_Start}\p{XID_Continue}*$/u.test(part)) {
        out += `.${part}`;
      } else {
        out += `[${JSON.stringify(part)}]`;
      }
    } else {
      out += `[${String(part)}]`;
    }
  }

  return out;
}
