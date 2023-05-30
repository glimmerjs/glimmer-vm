export class QUnitEnv {
  static initGlobal(): QUnitEnv {
    return new QUnitEnv(QUnit);
  }

  #qunit: QUnit;

  constructor(qunit: QUnit) {
    this.#qunit = qunit;
  }

  use(plugin: (qunit: QUnit) => void) {
    plugin(this.#qunit);
  }

  setupTestDOM() {
    let qunitDiv = document.createElement('div');
    qunitDiv.id = 'qunit';
    let qunitFixtureDiv = document.createElement('div');
    qunitFixtureDiv.id = 'qunit-fixture';

    document.body.append(qunitDiv, qunitFixtureDiv);
  }

  hasFlag(flag: string): boolean {
    let location = typeof window !== 'undefined' && window.location;
    return location && new RegExp(`[?&]${flag}`).test(location.search);
  }

  getFlag(flag: string): string | null {
    return new URL(location.href).searchParams.get(flag);
  }
}
