/* eslint-disable import/no-extraneous-dependencies */
import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';
import { defaultReporter } from '@web/test-runner';
// import { browserstackLauncher } from '@web/test-runner-browserstack';
import { webdriverLauncher } from '@web/test-runner-webdriver';
// import { createServer } from 'vite';

// let server = await createServer({ server: { hmr: false } });
// await server.listen();

const vitePort = 4444;
// const vitePort = server.config.server.port;
// const viteProtocol = server.config.server.https ? 'https' : 'http';
// const path = `${viteProtocol}://0.0.0.0:${vitePort}`;
// console.log(`\t${path}`);

// const sharedCapabilities = {
//   'browserstack.user': process.env.BROWSERSTACK_USERNAME,
//   'browserstack.key': process.env.BROWSERSTACK_ACCESS_KEY,
//   project: '',
//   name: 'glimmer-vm',
//   build: `build ${process.env.GITHUB_RUN_NUMBER || 'unknown'}`,
// };

export default {
  // We point at a lone file because we don't want @web/test-runner
  // to actually do anything with `files`, but `files` is a required config option.
  files: ['testem.js'],
  port: vitePort,
  // Launches Vite
  plugins: [vitePlugin()],
  reporters: [defaultReporter({ reportTestProgress: true, reportTestResults: true })],
  browsers: [
    webdriverLauncher({
      automationProtocol: 'webdriver',
      port: vitePort,
      path: '/',
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            // --no-sandbox is needed when running Chrome inside a container
            process.env.CI ? '--no-sandbox' : null,
            '--headless=new',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--mute-audio',
            '--remote-debugging-port=0',
            '--window-size=1440,900',
          ].filter(Boolean),
        },
      },
    }),
    // webdriverLauncher({
    //   automationProtocol: 'webdriver',
    //   path: '/',
    //   capabilities: {
    //     browserName: 'firefox',
    //     'moz:firefoxOptions': {
    //       args: ['-headless'],
    //     },
    //   },
    // }),
    // browserstackLauncher({
    //   ...sharedCapabilities,
    //   browserName: 'Chrome',
    //   os: 'Windows',
    //   os_version: '10',
    // }),
  ],
};
