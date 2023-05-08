/* eslint-disable import/no-extraneous-dependencies */
import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';
import { defaultReporter } from '@web/test-runner';
// import { browserstackLauncher } from '@web/test-runner-browserstack';
import { webdriverLauncher } from '@web/test-runner-webdriver';

// const sharedCapabilities = {
//   'browserstack.user': process.env.BROWSERSTACK_USERNAME,
//   'browserstack.key': process.env.BROWSERSTACK_ACCESS_KEY,
//   project: '',
//   name: 'glimmer-vm',
//   build: `build ${process.env.GITHUB_RUN_NUMBER || 'unknown'}`,
// };

export default {
  // @web/test-runner does not decide what tests to run
  files: ['**/*.ts'],
  // Launches Vite
  plugins: [vitePlugin()],
  reporters: [defaultReporter({ reportTestProgress: true, reportTestResults: true })],
  browsers: [
    webdriverLauncher({
      automationProtocol: 'webdriver',
      path: '/',
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            // --no-sandbox is needed when running Chrome inside a container
            process.env.CI ? '--no-sandbox' : null,
            '--headless',
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
    webdriverLauncher({
      automationProtocol: 'webdriver',
      path: '/',
      capabilities: {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          args: ['-headless'],
        },
      },
    }),
    // browserstackLauncher({
    //   ...sharedCapabilities,
    //   browserName: 'Chrome',
    //   os: 'Windows',
    //   os_version: '10',
    // }),
  ],
};
