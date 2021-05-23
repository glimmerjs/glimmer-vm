import { Source } from '@glimmer/interfaces';
import { getValue, createCache } from '@glimmer/validator';

export function createConcatSource(partSources: Source[]): Source<string | null> {
  return createCache(() => {
    let parts = [];

    for (let i = 0; i < partSources.length; i++) {
      let part = getValue(partSources[i]);

      if (part !== null && part !== undefined) {
        if (typeof (part as object).toString !== 'function') {
          parts.push('');
        } else {
          parts.push(String(part));
        }
      }
    }

    if (parts.length > 0) {
      return parts.join('');
    }

    return null;
  });
}
