export class RecordedEvents {
  #events: string[] = [];

  record(event: string) {
    this.#events.push(event);
  }

  finalize() {
    const filtered = this.#events.filter((e) => !e.includes(':'));

    if (filtered.length !== 0) {
      QUnit.assert.deepEqual(
        this.#events.filter((e) => !e.includes(':')),
        [],
        'Expected all unprefixed events to be verified during the test.\nFull event log:\n' +
          this.#events.join('\n')
      );
    }
  }

  get unprefixed(): { expect: (expectedEvents: string[]) => void } {
    return {
      expect: (expectedEvents) => {
        const filteredEvents = this.#events.filter((e) => !e.includes(':'));
        this.#events = [];

        if (QUnit.equiv(filteredEvents, expectedEvents)) {
          QUnit.assert.deepEqual(filteredEvents, expectedEvents);
        } else {
          QUnit.assert.deepEqual(
            filteredEvents,
            expectedEvents,
            `Full event log:\n${this.#events.map((e) => `  - ${e}`).join('\n')}`
          );
        }
      },
    };
  }

  prefixed(
    prefixes: string[],
    options?: { exclude: 'unprefixed' }
  ): { expect: (expectedEvents: string[]) => void } {
    const prefixSet = new Set<string | undefined>(prefixes);
    return {
      expect: (expectedEvents) => {
        const filteredEvents = this.#events.filter((e) => {
          if (prefixSet.has(e.split(':')[0])) return true;
          if (options?.exclude === 'unprefixed') return false;
          return !e.includes(':');
        });
        this.#events = [];

        if (QUnit.equiv(filteredEvents, expectedEvents)) {
          QUnit.assert.deepEqual(filteredEvents, expectedEvents);
        } else {
          QUnit.assert.deepEqual(
            filteredEvents,
            expectedEvents,
            `Full event log:\n${this.#events.map((e) => `  - ${e}`).join('\n')}`
          );
        }
      },
    };
  }

  readonly all = {
    expect: (expectedEvents: string[]) => {
      const actualEvents = this.#events;
      this.#events = [];

      QUnit.assert.deepEqual(actualEvents, expectedEvents);
    },
  };

  expect(expectedEvents: string[]) {
    this.unprefixed.expect(expectedEvents);
  }
}
