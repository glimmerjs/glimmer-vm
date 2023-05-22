const { setupQunit } = await import('@glimmer-workspace/integration-tests');

const { smokeTest } = await setupQunit();

const packages = await import.meta.glob('../packages/@glimmer/*/test/**/*-test.ts');
const integrationTestFiles = await import.meta.glob(
  '../packages/@glimmer-workspace/*/test/**/*-test.ts'
);

let smokeTestFile = '../packages/@glimmer-workspace/integration-tests/test/smoke-test.ts';

// evaluate the tests before starting QUnit
for (const [name, pkg] of Object.entries(packages)) {
  await pkg();
}

for (const [name, pkg] of Object.entries(integrationTestFiles)) {
  if (name === smokeTestFile && !smokeTest) {
    continue;
  }

  await pkg();
}

QUnit.start();

export {};
