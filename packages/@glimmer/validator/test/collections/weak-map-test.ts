// import Component from '@glimmer/component';
// import { setupRenderingTest } from 'ember-qunit';
// import { module, test } from 'qunit';
// import { TrackedWeakMap } from 'tracked-built-ins';
//
// import { reactivityTest } from '../helpers/reactivity';
//
// module('TrackedWeakMap', function (hooks) {
//   setupRenderingTest(hooks);
//
//   test('constructor', (assert) => {
//     const obj = {};
//     const map = new TrackedWeakMap([[obj, 123]]);
//
//     assert.equal(map.get(obj), 123);
//     assert.ok(map instanceof WeakMap);
//   });
//
//   test('does not work with built-ins', (assert) => {
//     const map = new TrackedWeakMap();
//
//     assert.throws(
//       // @ts-expect-error -- point is testing constructor error
//       () => map.set('aoeu', 123),
//       /Invalid value used as weak map key/u
//     );
//     assert.throws(
//       // @ts-expect-error -- point is testing constructor error
//       () => map.set(true, 123),
//       /Invalid value used as weak map key/u
//     );
//     assert.throws(
//       // @ts-expect-error -- point is testing constructor error
//       () => map.set(123, 123),
//       /Invalid value used as weak map key/u
//     );
//     assert.throws(
//       // @ts-expect-error -- point is testing constructor error
//       () => map.set(undefined, 123),
//       /Invalid value used as weak map key/u
//     );
//   });
//
//   test('get/set', (assert) => {
//     const obj = {};
//     const map = new TrackedWeakMap();
//
//     map.set(obj, 123);
//     assert.equal(map.get(obj), 123);
//
//     map.set(obj, 456);
//     assert.equal(map.get(obj), 456);
//   });
//
//   test('has', (assert) => {
//     const obj = {};
//     const map = new TrackedWeakMap();
//
//     assert.false(map.has(obj));
//     map.set(obj, 123);
//     assert.true(map.has(obj));
//   });
//
//   test('delete', (assert) => {
//     const obj = {};
//     const map = new TrackedWeakMap();
//
//     assert.false(map.has(obj));
//
//     map.set(obj, 123);
//     assert.true(map.has(obj));
//
//     map.delete(obj);
//     assert.false(map.has(obj));
//   });
//
//   reactivityTest(
//     'get/set',
//     class extends Component {
//       obj = {};
//       map = new TrackedWeakMap();
//
//       get value() {
//         return this.map.get(this.obj);
//       }
//
//       update() {
//         this.map.set(this.obj, 123);
//       }
//     }
//   );
//
//   reactivityTest(
//     'get/set existing value',
//     class extends Component {
//       obj = {};
//       map = new TrackedWeakMap([[this.obj, 456]]);
//
//       get value() {
//         return this.map.get(this.obj);
//       }
//
//       update() {
//         this.map.set(this.obj, 123);
//       }
//     }
//   );
//
//   reactivityTest(
//     'get/set unrelated value',
//     class extends Component {
//       obj = {};
//       obj2 = {};
//       map = new TrackedWeakMap([[this.obj, 456]]);
//
//       get value() {
//         return this.map.get(this.obj);
//       }
//
//       update() {
//         this.map.set(this.obj2, 123);
//       }
//     },
//     false
//   );
//
//   reactivityTest(
//     'has',
//     class extends Component {
//       obj = {};
//       map = new TrackedWeakMap();
//
//       get value() {
//         return this.map.has(this.obj);
//       }
//
//       update() {
//         this.map.set(this.obj, 123);
//       }
//     }
//   );
//
//   reactivityTest(
//     'delete',
//     class extends Component {
//       obj = {};
//       map = new TrackedWeakMap([[this.obj, 123]]);
//
//       get value() {
//         return this.map.get(this.obj);
//       }
//
//       update() {
//         this.map.delete(this.obj);
//       }
//     }
//   );
//
//   reactivityTest(
//     'delete unrelated value',
//     class extends Component {
//       obj = {};
//       obj2 = {};
//       map = new TrackedWeakMap([
//         [this.obj, 123],
//         [this.obj2, 456],
//       ]);
//
//       get value() {
//         return this.map.get(this.obj);
//       }
//
//       update() {
//         this.map.delete(this.obj2);
//       }
//     },
//     false
//   );
// });
