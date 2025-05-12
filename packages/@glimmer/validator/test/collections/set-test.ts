// import Component from '@glimmer/component';
// import { setupRenderingTest } from 'ember-qunit';
// import { expectTypeOf } from 'expect-type';
// import { module, test } from 'qunit';
// import { TrackedSet } from 'tracked-built-ins';
//
// import { eachReactivityTest } from '../helpers/collection-reactivity';
// import { reactivityTest } from '../helpers/reactivity';
//
// expectTypeOf<TrackedSet<string>>().toMatchTypeOf<Set<string>>();
// expectTypeOf<Set<string>>().not.toEqualTypeOf<TrackedSet<string>>();
//
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// type AnyFn = (...args: any[]) => any;
//
// module('TrackedSet', function (hooks) {
//   setupRenderingTest(hooks);
//
//   test('constructor', (assert) => {
//     const set = new TrackedSet(['foo', 123]);
//
//     assert.true(set.has('foo'));
//     assert.equal(set.size, 2);
//     assert.ok(set instanceof Set);
//
//     const setFromSet = new TrackedSet(set);
//     assert.true(setFromSet.has('foo'));
//     assert.equal(setFromSet.size, 2);
//     assert.ok(setFromSet instanceof Set);
//
//     const setFromEmpty = new TrackedSet();
//     assert.false(setFromEmpty.has('anything'));
//     assert.equal(setFromEmpty.size, 0);
//     assert.ok(setFromEmpty instanceof Set);
//   });
//
//   test('works with all kinds of values', (assert) => {
//     const set = new TrackedSet<
//       string | Record<PropertyKey, unknown> | AnyFn | number | boolean | null
//     >([
//       'foo',
//       {},
//       () => {
//         /* no op */
//       },
//       123,
//       true,
//       null,
//     ]);
//
//     assert.equal(set.size, 6);
//   });
//
//   test('add/has', (assert) => {
//     const set = new TrackedSet();
//
//     set.add('foo');
//     assert.true(set.has('foo'));
//   });
//
//   test('entries', (assert) => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     const iter = set.entries();
//
//     assert.deepEqual(iter.next().value, [0, 0]);
//     assert.deepEqual(iter.next().value, [2, 2]);
//     assert.deepEqual(iter.next().value, [1, 1]);
//     assert.true(iter.next().done);
//   });
//
//   test('keys', (assert) => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     const iter = set.keys();
//
//     assert.equal(iter.next().value, 0);
//     assert.equal(iter.next().value, 2);
//     assert.equal(iter.next().value, 1);
//     assert.true(iter.next().done);
//   });
//
//   test('values', (assert) => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     const iter = set.values();
//
//     assert.equal(iter.next().value, 0);
//     assert.equal(iter.next().value, 2);
//     assert.equal(iter.next().value, 1);
//     assert.true(iter.next().done);
//   });
//
//   test('union', (assert) => {
//     const set = new TrackedSet();
//     const set2 = new TrackedSet();
//     const nativeSet = new Set();
//
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     set2.add(2);
//     set2.add(3);
//
//     nativeSet.add(0);
//     nativeSet.add(5);
//
//     let iter = set.union(set2).values();
//
//     assert.equal(iter.next().value, 0);
//     assert.equal(iter.next().value, 2);
//     assert.equal(iter.next().value, 1);
//     assert.equal(iter.next().value, 3);
//     assert.true(iter.next().done);
//
//     let iter2 = set.union(nativeSet).values();
//
//     assert.equal(iter2.next().value, 0);
//     assert.equal(iter2.next().value, 2);
//     assert.equal(iter2.next().value, 1);
//     assert.equal(iter2.next().value, 5);
//     assert.true(iter2.next().done);
//   });
//
//   test('intersection', (assert) => {
//     const set = new TrackedSet();
//     const set2 = new TrackedSet();
//     const nativeSet = new Set();
//
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     set2.add(2);
//     set2.add(3);
//
//     nativeSet.add(0);
//     nativeSet.add(5);
//
//     let iter = set.intersection(set2).values();
//
//     assert.equal(iter.next().value, 2);
//     assert.true(iter.next().done);
//
//     let iter2 = set.intersection(nativeSet).values();
//
//     assert.equal(iter2.next().value, 0);
//     assert.true(iter2.next().done);
//   });
//
//   test('difference', (assert) => {
//     const set = new TrackedSet();
//     const set2 = new TrackedSet();
//     const nativeSet = new Set();
//
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     set2.add(2);
//     set2.add(3);
//
//     nativeSet.add(0);
//     nativeSet.add(5);
//
//     let iter = set.difference(set2).values();
//
//     assert.equal(iter.next().value, 0);
//     assert.equal(iter.next().value, 1);
//     assert.true(iter.next().done);
//
//     let iter2 = set.difference(nativeSet).values();
//
//     assert.equal(iter2.next().value, 2);
//     assert.equal(iter2.next().value, 1);
//     assert.true(iter2.next().done);
//   });
//
//   test('symmetricDifference', (assert) => {
//     const set = new TrackedSet();
//     const set2 = new TrackedSet();
//     const nativeSet = new Set();
//
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     set2.add(2);
//     set2.add(3);
//
//     nativeSet.add(0);
//     nativeSet.add(5);
//
//     let iter = set.symmetricDifference(set2).values();
//
//     assert.equal(iter.next().value, 0);
//     assert.equal(iter.next().value, 1);
//     assert.equal(iter.next().value, 3);
//     assert.true(iter.next().done);
//
//     let iter2 = set.symmetricDifference(nativeSet).values();
//
//     assert.equal(iter2.next().value, 2);
//     assert.equal(iter2.next().value, 1);
//     assert.equal(iter2.next().value, 5);
//     assert.true(iter2.next().done);
//   });
//
//   test('isSubsetOf', (assert) => {
//     const set = new TrackedSet();
//     const set2 = new TrackedSet();
//     const nativeSet = new Set();
//
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     set2.add(2);
//     set2.add(3);
//
//     nativeSet.add(0);
//     nativeSet.add(5);
//
//     assert.false(set.isSubsetOf(set2));
//
//     set2.add(0);
//     set2.add(1);
//
//     assert.true(set.isSubsetOf(set2));
//
//     assert.false(set.isSubsetOf(nativeSet));
//
//     nativeSet.add(1);
//     nativeSet.add(2);
//
//     assert.true(set.isSubsetOf(nativeSet));
//   });
//
//   test('isSupersetOf', (assert) => {
//     const set = new TrackedSet();
//     const set2 = new TrackedSet();
//     const nativeSet = new Set();
//
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     set2.add(2);
//     set2.add(3);
//
//     nativeSet.add(0);
//     nativeSet.add(5);
//
//     assert.false(set.isSupersetOf(set2));
//
//     set.add(3);
//
//     assert.true(set.isSupersetOf(set2));
//
//     assert.false(set.isSupersetOf(nativeSet));
//
//     set.add(5);
//
//     assert.true(set.isSupersetOf(nativeSet));
//   });
//
//   test('isDisjointFrom', (assert) => {
//     const set = new TrackedSet();
//     const set2 = new TrackedSet();
//     const nativeSet = new Set();
//
//     set.add(0);
//     set.add(2);
//     set.add(1);
//
//     set2.add(3);
//
//     nativeSet.add(5);
//
//     assert.true(set.isDisjointFrom(set2));
//
//     set2.add(2);
//
//     assert.false(set.isDisjointFrom(set2));
//
//     assert.true(set.isDisjointFrom(nativeSet));
//
//     nativeSet.add(0);
//
//     assert.false(set.isDisjointFrom(nativeSet));
//   });
//
//   test('forEach', (assert) => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(1);
//     set.add(2);
//
//     let count = 0;
//     let values = '';
//
//     set.forEach((v, k) => {
//       count++;
//       values += k;
//       values += v;
//     });
//
//     assert.equal(count, 3);
//     assert.equal(values, '001122');
//   });
//
//   test('size', (assert) => {
//     const set = new TrackedSet();
//     assert.equal(set.size, 0);
//
//     set.add(0);
//     assert.equal(set.size, 1);
//
//     set.add(1);
//     assert.equal(set.size, 2);
//
//     set.delete(1);
//     assert.equal(set.size, 1);
//
//     set.add(0);
//     assert.equal(set.size, 1);
//   });
//
//   test('delete', (assert) => {
//     const set = new TrackedSet();
//
//     assert.false(set.has(0));
//
//     set.add(0);
//     assert.true(set.has(0));
//
//     set.delete(0);
//     assert.false(set.has(0));
//   });
//
//   test('clear', (assert) => {
//     const set = new TrackedSet();
//
//     set.add(0);
//     set.add(1);
//     assert.equal(set.size, 2);
//
//     set.clear();
//     assert.equal(set.size, 0);
//     assert.false(set.has(0));
//     assert.false(set.has(1));
//   });
//
//   reactivityTest(
//     'add/has',
//     class extends Component {
//       set = new TrackedSet();
//
//       get value() {
//         return this.set.has('foo');
//       }
//
//       update() {
//         this.set.add('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'add/has existing value',
//     class extends Component {
//       set = new TrackedSet(['foo']);
//
//       get value() {
//         return this.set.has('foo');
//       }
//
//       update() {
//         this.set.add('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'add/has unrelated value',
//     class extends Component {
//       set = new TrackedSet();
//
//       get value() {
//         return this.set.has('foo');
//       }
//
//       update() {
//         this.set.add('bar');
//       }
//     },
//     false
//   );
//
//   reactivityTest(
//     'entries',
//     class extends Component {
//       set = new TrackedSet();
//
//       get value() {
//         return this.set.entries();
//       }
//
//       update() {
//         this.set.add('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'keys',
//     class extends Component {
//       set = new TrackedSet();
//
//       get value() {
//         return this.set.keys();
//       }
//
//       update() {
//         this.set.add('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'values',
//     class extends Component {
//       set = new TrackedSet();
//
//       get value() {
//         return this.set.values();
//       }
//
//       update() {
//         this.set.add('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'forEach',
//     class extends Component {
//       set = new TrackedSet();
//
//       get value() {
//         this.set.forEach(() => {
//           /* no-op */
//         });
//         return 'test';
//       }
//
//       update() {
//         this.set.add('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'size',
//     class extends Component {
//       set = new TrackedSet();
//
//       get value() {
//         return this.set.size;
//       }
//
//       update() {
//         this.set.add('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'delete',
//     class extends Component {
//       set = new TrackedSet(['foo', 123]);
//
//       get value() {
//         return this.set.has('foo');
//       }
//
//       update() {
//         this.set.delete('foo');
//       }
//     }
//   );
//
//   reactivityTest(
//     'delete unrelated value',
//     class extends Component {
//       set = new TrackedSet(['foo', 123]);
//
//       get value() {
//         return this.set.has('foo');
//       }
//
//       update() {
//         this.set.delete(123);
//       }
//     },
//     false
//   );
//
//   reactivityTest(
//     'clear',
//     class extends Component {
//       set = new TrackedSet(['foo', 123]);
//
//       get value() {
//         return this.set.has('foo');
//       }
//
//       update() {
//         this.set.clear();
//       }
//     }
//   );
//
//   eachReactivityTest(
//     'add',
//     class extends Component {
//       collection = new TrackedSet(['foo', 123]);
//
//       update() {
//         this.collection.add('bar');
//       }
//     }
//   );
//
//   eachReactivityTest(
//     'add existing value',
//     class extends Component {
//       collection = new TrackedSet(['foo', 123]);
//
//       update() {
//         this.collection.add('foo');
//       }
//     }
//   );
//
//   // TODO: These tests are currently unstable on release, turn back on once
//   // behavior is fixed
//
//   // eachInReactivityTest(
//   //   'add',
//   //   class extends Component {
//   //     collection = new TrackedSet(['foo', 123]);
//
//   //     update() {
//   //       this.collection.add('bar');
//   //     }
//   //   }
//   // );
//
//   // eachInReactivityTest(
//   //   'add existing value',
//   //   class extends Component {
//   //     collection = new TrackedSet(['foo', 123]);
//
//   //     update() {
//   //       this.collection.add('foo');
//   //     }
//   //   }
//   // );
// });
