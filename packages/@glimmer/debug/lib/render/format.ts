import type { StyleName } from './styles';

import { STYLES } from './styles';

type Format = { style: string };
export type IntoFormat = { style: string } | StyleName;

function intoFormat(format: IntoFormat): Format {
  if (typeof format === 'string') {
    return { style: STYLES[format] };
  } else {
    return format;
  }
}

export function formats(...formats: IntoFormat[]): string {
  return formats.map((c) => intoFormat(c).style).join('; ');
}
