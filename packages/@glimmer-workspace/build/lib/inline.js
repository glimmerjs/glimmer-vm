import { readFileSync } from 'node:fs';

const INLINE_PREFIX = '\0inline:';

/**
 * @returns {import("rollup").Plugin}
 */
export const inline = () => {
  return {
    name: 'inline',

    async resolveId(source, importer, options) {
      if (source.endsWith('?inline')) {
        let path = source.slice(0, -7);
        let resolved = await this.resolve(path, importer, options);

        if (resolved && !resolved.external) {
          await this.load(resolved);
          return INLINE_PREFIX + resolved.id;
        }
      }
    },

    load(id) {
      if (id.startsWith(INLINE_PREFIX)) {
        let path = id.slice(INLINE_PREFIX.length);
        let code = readFileSync(path, 'utf8');

        return {
          code: `export default ${JSON.stringify(code)};`,
        };
      }
    },
  };
};

export default inline;
