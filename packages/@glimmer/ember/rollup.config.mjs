import { Addon } from '@embroider/addon-dev/rollup';
import fs from 'node:fs/promises';
import rollupSWC from '@rollup/plugin-swc';

const addon = new Addon({
  srcDir: 'lib',
  destDir: 'dist',
});
export default [
  {
    output: addon.output(),
    plugins: [
      addon.publicEntrypoints(['**/*.js']),
      addon.dependencies(),
      rollupSWC({
        swc: {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
            target: 'es2022',
          },
        },
      }),
      {
        name: 'create declarations',
        async closeBundle() {
          await fs.mkdir('dist', { recursive: true });

          let contents = await fs.readdir('lib');

          await Promise.all(
            contents.map((c) => {
              return fs.cp(`lib/${c}`, `dist/${c.replace('.ts', '.d.ts')}`);
            })
          );
        },
      },
      addon.clean(),
    ],
  },
];
