import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { beginTestSteps, endTestSteps, verifySteps } from '@glimmer/util';
import { consumeTag, createTag, dirtyTag } from '@glimmer/validator';

import { RenderTest } from '../render-test';
import { test } from '../test-decorator';
import { tracked } from '../test-helpers/tracked';

export class EachSuite extends RenderTest {
  static suiteName = '#each';

  beforeEach() {
    if (LOCAL_DEBUG) {
      beginTestSteps?.();
    }
  }

  afterEach() {
    if (LOCAL_DEBUG) {
      endTestSteps?.();
    }
  }

  @test
  'basic #each'() {
    let list = [1, 2, 3, 4];
    this.render('{{#each this.list key="@index" as |item|}}{{item}}{{else}}Empty{{/each}}', {
      list,
    });
    this.assertHTML('1234');
    this.assertStableRerender();

    list.push(5, 6);
    this.rerender({ list });
    this.assertHTML('123456');
    this.assertStableNodes();

    list = [];
    this.rerender({ list });
    this.assertHTML('Empty');
    this.assertStableNodes();

    list = [1, 2, 3, 4];
    this.rerender({ list });
    this.assertHTML('1234');
    this.assertStableNodes();
  }

  @test
  'autotracked custom iterable'() {
    if (typeof Symbol !== 'function') {
      QUnit.assert.ok(true, 'skipping platform without iterable');
      return;
    }

    let list = {
      arr: [1, 2, 3, 4],
      tag: createTag(),

      [Symbol.iterator]() {
        consumeTag(this.tag);
        return this.arr[Symbol.iterator]();
      },

      push(...vals: number[]) {
        dirtyTag(this.tag);
        this.arr.push(...vals);
      },

      clear() {
        dirtyTag(this.tag);
        this.arr.splice(0, this.arr.length);
      },
    };
    this.render('{{#each this.list key="@index" as |item|}}{{item}}{{else}}Empty{{/each}}', {
      list,
    });
    this.assertHTML('1234');
    this.assertStableRerender();

    list.push(5, 6);
    this.rerender();
    this.assertHTML('123456');
    this.assertStableNodes();

    list.clear();
    this.rerender();
    this.assertHTML('Empty');
    this.assertStableNodes();

    list.push(1, 2, 3, 4);
    this.rerender();
    this.assertHTML('1234');
    this.assertStableNodes();
  }

  @test
  'keyed #each'() {
    let list = [{ text: 'hello' }];
    this.render('{{#each this.list key="text" as |item|}}{{item.text}}{{else}}Empty{{/each}}', {
      list,
    });
    this.assertHTML('hello');
    this.assertStableRerender();

    list.push({ text: ' ' }, { text: 'World' });
    this.rerender({ list });
    this.assertHTML('hello World');
    this.assertStableNodes();

    list = [];
    this.rerender({ list });
    this.assertHTML('Empty');
    this.assertStableNodes();

    list = [{ text: 'hello' }];
    this.rerender({ list });
    this.assertHTML('hello');
    this.assertStableNodes();
  }

  @test
  'receives the index as the second parameter'() {
    let list = [1, 2, 3, 4];
    this.render(
      '{{#each this.list key="@index" as |item i|}}{{item}}-{{i}}:{{else}}Empty{{/each}}',
      {
        list,
      }
    );
    this.assertHTML('1-0:2-1:3-2:4-3:');
    this.assertStableRerender();

    list.push(5, 6);
    this.rerender({ list });
    this.assertHTML('1-0:2-1:3-2:4-3:5-4:6-5:');
    this.assertStableNodes();

    list = [];
    this.rerender({ list });
    this.assertHTML('Empty');
    this.assertStableNodes();

    list = [1, 2, 3, 4];
    this.rerender({ list });
    this.assertHTML('1-0:2-1:3-2:4-3:');
    this.assertStableNodes();
  }

  @test
  'receives the index as the second parameter (when key=@identity)'() {
    let v1 = value(1);
    let v2 = value(2);
    let v3 = value(3);
    let v4 = value(4);
    let v5 = value(5);
    let v6 = value(6);

    let list = [v1, v2, v3, v4];
    this.render(
      '{{#each this.list key="@identity" as |item i|}}{{item.current}}-{{i}}{{else}}Empty{{/each}}',
      {
        list,
      }
    );
    this.assertHTML('1-02-13-24-3');
    this.assertStableRerender();

    list.push(v5, v6);
    this.rerender({ list });
    this.assertHTML('1-02-13-24-35-46-5');
    this.assertStableNodes();

    v1.current = 1000;
    this.rerender({ list });
    this.assertHTML('1000-02-13-24-35-46-5');
    this.assertStableNodes();

    list = [];
    this.rerender({ list });
    this.assertHTML('Empty');
    this.assertStableNodes();

    list = [value(1), value(2), value(3), value(4)];
    this.rerender({ list });
    this.assertHTML('1-02-13-24-3');
    this.assertStableNodes();
  }

  @test
  'it can render duplicate primitive items'() {
    let list = ['a', 'a', 'a'];
    this.render('{{#each this.list key="@index" as |item|}}{{item}}{{/each}}', {
      list,
    });
    this.assertHTML('aaa');
    this.assertStableRerender();

    list.push('a', 'a');
    this.rerender({ list });
    this.assertHTML('aaaaa');
    this.assertStableNodes();

    list = ['a', 'a', 'a'];
    this.rerender({ list });
    this.assertHTML('aaa');
    this.assertStableNodes();
  }

  @test
  'it can render duplicate objects'() {
    let dup = { text: 'dup' };
    let list = [dup, dup, { text: 'uniq' }];
    this.render('{{#each this.list key="@index" as |item|}}{{item.text}}{{/each}}', {
      list,
    });
    this.assertHTML('dupdupuniq');
    this.assertStableRerender();

    list.push(dup);
    this.rerender({ list });
    this.assertHTML('dupdupuniqdup');
    this.assertStableNodes();

    list = [dup, dup, { text: 'uniq' }];
    this.rerender({ list });
    this.assertHTML('dupdupuniq');
    this.assertStableNodes();
  }

  @test
  'it renders all items with duplicate key values'() {
    class Item {
      @tracked text: string;

      constructor(text: string) {
        this.text = text;
      }
    }

    let list = [new Item('Hello'), new Item('Hello'), new Item('Hello')];

    this.render(`{{#each this.list key="text" as |item|}}{{item.text}}{{/each}}`, {
      list,
    });

    this.assertHTML('HelloHelloHello');
    this.assertStableRerender();

    for (let item of list) item.text = 'Goodbye';

    this.rerender({ list });
    this.assertHTML('GoodbyeGoodbyeGoodbye');
    this.assertStableNodes();

    list = [new Item('Hello'), new Item('Hello'), new Item('Hello')];

    this.rerender({ list });
    this.assertHTML('HelloHelloHello');
    this.assertStableNodes();
  }

  @test
  'it updates items if their key has not changed, and the items are tracked'() {
    class Item {
      @tracked public text: string;

      constructor(text: string) {
        this.text = text;
      }
    }

    let list = [new Item('Hello'), new Item('Hello'), new Item('Hello')];

    this.render(`{{#each this.list key="@identity" as |item|}}{{item.text}}{{/each}}`, {
      list,
    });

    this.assertHTML('HelloHelloHello');
    this.assertStableRerender();

    for (let item of list) item.text = 'Goodbye';

    this.rerender({ list });
    this.assertHTML('GoodbyeGoodbyeGoodbye');
    this.assertStableNodes();

    list = [{ text: 'Hello' }, { text: 'Hello' }, { text: 'Hello' }];

    this.rerender({ list });
    this.assertHTML('HelloHelloHello');
    this.assertStableNodes();
  }

  @test
  'it does not update items if their key has not changed, and the items are not tracked'() {
    let list = [{ text: 'Hello' }, { text: 'Hello' }, { text: 'Hello' }];

    this.render(`{{#each this.list key="@identity" as |item|}}{{item.text}}{{/each}}`, {
      list,
    });

    this.assertHTML('HelloHelloHello');
    this.assertStableRerender();

    for (let item of list) item.text = 'Goodbye';

    this.rerender({ list });
    this.assertHTML('HelloHelloHello');
    this.assertStableNodes();
  }

  @test
  'scoped variable not available outside list'() {
    let list = ['Wycats'];

    this.render(
      `{{this.name}}-{{#each this.list key="@index" as |name|}}{{name}}{{/each}}-{{this.name}}`,
      {
        list,
        name: 'Stef',
      }
    );

    this.assertHTML('Stef-Wycats-Stef');
    this.assertStableRerender();

    list.push(' ', 'Chad');
    this.rerender({ list });
    this.assertHTML('Stef-Wycats Chad-Stef');
    this.assertStableNodes();

    this.rerender({ name: 'Tom' });
    this.assertHTML('Tom-Wycats Chad-Tom');
    this.assertStableNodes();

    list = ['Wycats'];

    this.rerender({ list, name: 'Stef' });
    this.assertHTML('Stef-Wycats-Stef');
    this.assertStableNodes();
  }

  @test
  'else template is displayed with context'() {
    let list: string[] = [];

    this.render(
      `{{#each this.list key="@index" as |name|}}Has thing{{else}}No thing {{this.otherThing}}{{/each}}`,
      {
        list,
        otherThing: 'Chad',
      }
    );

    this.assertHTML('No thing Chad');
    this.assertStableRerender();

    this.rerender({ otherThing: 'Bill' });
    this.assertHTML('No thing Bill');
    this.assertStableNodes();

    list.push('thing');
    this.rerender({ list });
    this.assertHTML('Has thing');
    this.assertStableNodes();

    this.rerender({ otherThing: 'Chad', list: [] });
    this.assertHTML('No thing Chad');
    this.assertStableNodes();
  }

  @test
  'When re-iterated via swap #1, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = numbers();
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let a = array[1];
    let b = array[7];
    array[7] = a;
    array[1] = b;

    this.rerender({ arr: array });

    verifySteps?.(
      'list-updates',
      [
        ['retain', 1],
        ['move', 8],
        ['retain', 3],
        ['retain', 4],
        ['retain', 5],
        ['retain', 6],
        ['retain', 7],
        ['move', 2],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #2, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = numbers();
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let a = array[0];
    let b = array[7];
    array[7] = a;
    array[0] = b;

    this.rerender({ arr: array });

    verifySteps?.(
      'list-updates',
      [
        ['move', 8],
        ['retain', 2],
        ['retain', 3],
        ['retain', 4],
        ['retain', 5],
        ['retain', 6],
        ['retain', 7],
        ['move', 1],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #3, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = numbers();
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let a = array[0];
    let b = array[6];
    array[6] = a;
    array[0] = b;

    this.rerender({ arr: array });

    verifySteps?.(
      'list-updates',
      [
        ['move', 7],
        ['retain', 2],
        ['retain', 3],
        ['retain', 4],
        ['retain', 5],
        ['retain', 6],
        ['move', 1],
        ['retain', 8],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #4, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = numbers();
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let a = array[1];
    let b = array[3];
    let c = array[4];
    let d = array[6];
    array[6] = b;
    array[4] = a;
    array[3] = d;
    array[1] = c;

    this.rerender({ arr: array });

    verifySteps?.(
      'list-updates',
      [
        ['retain', 1],
        ['move', 5],
        ['retain', 3],
        ['move', 7],
        ['move', 2],
        ['retain', 6],
        ['move', 4],
        ['retain', 8],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #5, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = numbers();
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let a = array[1];
    let b = array[3];
    array[3] = a;
    array[1] = b;
    array.push(9);

    this.rerender({ arr: array });

    verifySteps?.(
      'list-updates',
      [
        ['retain', 1],
        ['move', 4],
        ['retain', 3],
        ['move', 2],
        ['retain', 5],
        ['retain', 6],
        ['retain', 7],
        ['retain', 8],
        ['insert', 9],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #6, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = numbers();
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let a = array[1];
    let b = array[6];
    array[6] = a;
    array[1] = b;

    array.splice(2, 0, 9);

    this.rerender({ arr: array });

    verifySteps?.(
      'list-updates',
      [
        ['retain', 1],
        ['move', 7],
        ['insert', 9],
        ['retain', 3],
        ['retain', 4],
        ['retain', 5],
        ['retain', 6],
        ['move', 2],
        ['retain', 8],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #7, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = [1, 2, 3, 4, 5, 6, 7, 8];
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    array.shift();
    array.splice(2, 0, 9);

    this.rerender({ arr: array });

    verifySteps?.(
      'list-updates',
      [
        ['retain', 2],
        ['retain', 3],
        ['insert', 9],
        ['retain', 4],
        ['retain', 5],
        ['retain', 6],
        ['retain', 7],
        ['retain', 8],
        ['delete', 1],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #8, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = [1, 2, 3, 4, 5, 6, 7, 8];
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let shifted = [8, 1, 2, 3, 4, 5, 6, 7];

    this.rerender({ arr: shifted });

    verifySteps?.(
      'list-updates',
      [
        ['move', 8],
        ['move-retain', 1],
        ['retain', 2],
        ['retain', 3],
        ['retain', 4],
        ['retain', 5],
        ['retain', 6],
        ['retain', 7],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #9, the original references are updated'() {
    if (!LOCAL_DEBUG) return;

    let array = [1, 2, 3, 4, 5, 6, 7, 8];
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    let shifted = [2, 3, 4, 5, 6, 7, 8, 1];

    this.rerender({ arr: shifted });

    verifySteps?.(
      'list-updates',
      [
        ['retain', 2],
        ['retain', 3],
        ['retain', 4],
        ['retain', 5],
        ['retain', 6],
        ['retain', 7],
        ['retain', 8],
        ['move', 1],
      ],
      'list updated correctly'
    );
  }

  @test
  'When re-iterated via swap #10, the original references are updated'(assert: Assert) {
    if (!LOCAL_DEBUG) return;

    let array = [1, 2, 3, 4, 5, 6, 7, 8];
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    for (let index = 0; index < 100; index++) {
      shuffleArray(array);
      this.rerender({ arr: array });

      verifySteps?.('list-updates', (steps) => {
        let stats = getStepStats(steps as ListStep[]);

        let changedNodes = stats.move + stats.retain;
        assert.ok(changedNodes <= array.length, 'changed nodes count');
        assert.strictEqual(stats.insert, 0, 'inserted nodes count');
        assert.strictEqual(stats.delete, 0, 'deleted nodes count');
      });

      this.assertHTML(array.join(''));
    }
  }

  @test
  'When re-iterated via swap #11, the original references are updated'(assert: Assert) {
    if (!LOCAL_DEBUG) return;

    let array = [1, 2, 3, 4, 5, 6, 7, 8];
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    for (let index = 0; index < 100; index++) {
      let newArray = [...array];
      shuffleArray(newArray);
      let semiArray = newArray.slice(0, 5);
      this.rerender({ arr: semiArray });

      verifySteps?.('list-updates', (steps) => {
        let stats = getStepStats(steps as ListStep[]);

        let changedNodes = stats.move + stats.retain;
        assert.ok(changedNodes <= array.length, 'changed nodes count');
        assert.ok(stats.insert <= 3, 'inserted nodes count');
        assert.ok(stats.delete <= 3, 'deleted nodes count');
      });

      this.assertHTML(semiArray.join(''));
    }
  }

  @test
  'When re-iterated via swap #12, the original references are updated'(assert: Assert) {
    if (!LOCAL_DEBUG) return;

    let array = [1, 2, 3, 4, 5, 6, 7, 8];
    this.render(`{{#each this.arr as |item|}}{{item}}{{/each}}`, { arr: array });

    for (let index = 0; index < 100; index++) {
      let newArray = [...array];
      shuffleArray(newArray);
      let semiArray = [...newArray.slice(0, 5), 11, 12];
      this.rerender({ arr: semiArray });

      verifySteps?.('list-updates', (steps) => {
        let stats = getStepStats(steps as ListStep[]);

        let changedNodes = stats.move + stats.retain + stats.insert + stats.delete;
        assert.ok(changedNodes <= semiArray.length + 3, 'changed nodes count');
        assert.ok(stats.insert <= 3, 'inserted nodes count');
        assert.ok(stats.delete <= 3, 'deleted nodes count');
      });

      this.assertHTML(semiArray.join(''));
    }
  }

  @test
  're-iterating nested arrays works'() {
    let array = [
      [1, 2, 3, 4, 5],
      [4, 5, 6, 7, 8],
      [5, 6, 7, 8, 9],
    ];
    this.render(`{{#each this.arr as |sub|}}{{#each sub as |item|}}{{item}}{{/each}}{{/each}}`, {
      arr: array,
    });

    for (let index = 0; index < 100; index++) {
      for (let sub of array) {
        shuffleArray(sub);
      }

      this.rerender({ arr: array.map((sub) => [...sub]) });

      this.assertHTML(array.map((sub) => sub.join('')).join(''));
    }
  }
}

type ListStep = ['insert' | 'delete' | 'retain' | 'move', 'move-retain', unknown];

function getStepStats(history: ListStep[]) {
  let stats = {
    insert: 0,
    delete: 0,
    retain: 0,
    move: 0,
    'move-retain': 0,
  };

  for (let item of history) {
    stats[item[0]]++;
  }

  return stats;
}

function shuffleArray(array: unknown[]) {
  for (let index = array.length - 1; index > 0; index--) {
    let index_ = Math.floor(Math.random() * (index + 1));
    [array[index], array[index_]] = [array[index_], array[index]];
  }
}

class Value {
  @tracked current: number;

  constructor(initial: number) {
    this.current = initial;
  }
}

function value(index: number): Value {
  return new Value(index);
}

function numbers() {
  return [1, 2, 3, 4, 5, 6, 7, 8] as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];
}
