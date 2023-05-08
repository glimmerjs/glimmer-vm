import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';

export default {
  // For watching
  files: './packages/@glimmer/*/test/**/*-test.ts',
  // Launches Vite
  plugins: [vitePlugin()],
};
