export async function setupQunit() {
  const qunit = await import('qunit');
  await import('qunit/qunit/qunit.css');

  // @ts-expect-error
  globalThis['QUnit'] = qunit;

  const qunitDiv = document.createElement('div');
  qunitDiv.id = 'qunit';
  const qunitFixtureDiv = document.createElement('div');
  qunitFixtureDiv.id = 'qunit-fixture';

  document.body.append(qunitDiv, qunitFixtureDiv);

  // since all of our tests are synchronous, the QUnit
  // UI never has a chance to rerender / update. This
  // leads to a very long "white screen" when running
  // the tests
  //
  // this adds a very small amount of async, just to allow
  // the QUnit UI to rerender once per module completed

  const pause = () =>
    new Promise<void>((res) => {
      setTimeout(res, 10);
    });

  let start = performance.now();
  qunit.testDone(async () => {
    let gap = performance.now() - start;
    if (gap > 100) await pause();
  });

  qunit.moduleDone(pause);
}
