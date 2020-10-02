import { SerializedTemplateBlock } from '@glimmer/interfaces';
import { packed } from '@glimmer/wire-format';

export function decode(raw: string, encoder: 'default' | 'packed'): SerializedTemplateBlock {
  if (encoder === 'default') {
    return JSON.parse(raw);
  }
  let encoded = JSON.parse(raw) as packed.Template;
}
