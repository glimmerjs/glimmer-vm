// @ts-check

import child from 'child_process';
import puppeteer from 'puppeteer';

await new Promise((fulfill) => {
  const runvite = child.spawn('vite', ['--port', '60173'], {
    stdio: 'pipe',
  });

  process.on('exit', () => runvite.kill());

  runvite.stderr.on('data', (data) => {
    console.log('stderr', String(data));
  });

  runvite.stdout.on('data', (data) => {
    const chunk = String(data);
    if (chunk.includes('Local: ')) {
      fulfill();
    }
  });
});

const browser = await puppeteer.launch({
  headless: 'new',
});

// eslint-disable-next-line no-async-promise-executor
await new Promise(async (fulfill) => {
  const page = await browser.newPage();

  page.on('console', (msg) => {
    const location = msg.location();
    const text = msg.text();

    if (location.url.includes(`/qunit.js`)) {
      console.log(text);
    } else if (text === `[HARNESS] done`) {
      fulfill();
    }
  });

  await page.goto('http://localhost:60173?hidepassed&ci');
});

await browser.close();

process.exit(0);
