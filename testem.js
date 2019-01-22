'use strict';

let isCI = !!process.env.CI;
let smokeTests = !!process.env.SMOKE_TESTS

let config = {
  "framework": "qunit",
  "test_page": smokeTests ? "tests/index.html?smoke_tests=true" : "tests/index.html?hidepassed",
  "disable_watching": true,
  "browser_start_timeout": smokeTests ? 300000 : 30000,
  "launchers": {
    "Node": {
      "command": "./bin/run-node-tests.js",
      "protocol": "tap"
     }
  },
  "timeout":  smokeTests ? 300000 : 30000,
  "browser_args": {
    "Chrome": {
      "mode": "ci",
      "args": [
        '--disable-gpu',
        '—-timeout=300000',
        '--headless',
        '--no-sandbox',
        '--remote-debugging-port=9222'
      ]
    }
  },
  "launch_in_dev": [
    "Chrome",
    "Node"
  ],
  "launch_in_ci": [
    "Chrome",
    "Node"
  ]
};

if (isCI) {
  config.tap_quiet_logs = true;
}

module.exports = config;
