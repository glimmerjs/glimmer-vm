const { module, test } = QUnit;

import { DEBUG } from '@glimmer/local-debug-flags';
import { tracked, tagForProperty, UntrackedPropertyError, CONSTANT_TAG } from '..';

module('Tracked Properties');

if (DEBUG) {
  test('requesting a tag for an untracked property should throw an exception if mutated', (assert) => {
    class UntrackedPerson {
      firstName = 'Tom';
      get lastName() {
        return 'Dale';
      }

      set lastName(_value) {
      }

      toString() {
        return 'UntrackedPerson';
      }
    }

    let obj = new UntrackedPerson();
    tagForProperty(obj, 'firstName');
    tagForProperty(obj, 'lastName');

    assert.throws(() => {
      obj.firstName = 'Ricardo';
    }, /The property 'firstName' on UntrackedPerson was changed after being rendered. If you want to change a property used in a template after the component has rendered, mark the property as a tracked property with the @tracked decorator./);

    assert.throws(() => {
      obj.lastName = 'Mendes';
    }, /The property 'lastName' on UntrackedPerson was changed after being rendered. If you want to change a property used in a template after the component has rendered, mark the property as a tracked property with the @tracked decorator./);
  });
}

test('tracked properties can be read and written to', (assert) => {
  class TrackedPerson {
    @tracked firstName = 'Tom';
  }

  let obj = new TrackedPerson();
  assert.strictEqual(obj.firstName, 'Tom');
  obj.firstName = 'Edsger';
  assert.strictEqual(obj.firstName, 'Edsger');
});

test('can request a tag for a property', (assert) => {
  class TrackedPerson {
    @tracked firstName = 'Tom';
  }

  let obj = new TrackedPerson();
  assert.strictEqual(obj.firstName, 'Tom');

  let tag = tagForProperty(obj, 'firstName');
  let snapshot = tag.value();
  assert.ok(tag.validate(snapshot), 'tag should be valid to start');

  obj.firstName = 'Edsger';
  assert.strictEqual(tag.validate(snapshot), false, 'tag is invalidated after property is set');
  snapshot = tag.value();
  assert.strictEqual(tag.validate(snapshot), true, 'tag is valid on the second check');
});

test('can request a tag for non-objects and get a CONSTANT_TAG', (assert) => {
  let snapshot = CONSTANT_TAG.value();

  assert.ok(tagForProperty(null, 'foo').validate(snapshot));
  assert.ok(tagForProperty(undefined, 'foo').validate(snapshot));
  assert.ok(tagForProperty(12345, 'foo').validate(snapshot));
  assert.ok(tagForProperty(0, 'foo').validate(snapshot));
  assert.ok(tagForProperty(true, 'foo').validate(snapshot));
  assert.ok(tagForProperty(false, 'foo').validate(snapshot));
  assert.ok(tagForProperty('hello world', 'foo').validate(snapshot));

  if (typeof Symbol !== 'undefined') {
    assert.ok(tagForProperty(Symbol(), 'foo').validate(snapshot));
  }
});

test('can track a computed property', (assert) => {
  let count = 0;
  let firstName = "Tom";

  class TrackedPerson {
    @tracked get firstName() {
      return firstName + count++;
    }

    set firstName(value) {
      firstName = value;
    }
  }

  let obj = new TrackedPerson();
  assert.strictEqual(obj.firstName, 'Tom0');
  assert.strictEqual(obj.firstName, 'Tom1');

  let tag = tagForProperty(obj, 'firstName');
  let snapshot = tag.value();
  assert.ok(tag.validate(snapshot), 'tag should be valid to start');

  assert.strictEqual(obj.firstName, 'Tom2');
  assert.ok(tag.validate(snapshot), 'reading from property does not invalidate the tag');

  obj.firstName = 'Edsger';
  assert.strictEqual(tag.validate(snapshot), false, 'tag is invalidated after property is set');
  snapshot = tag.value();
  assert.strictEqual(obj.firstName, 'Edsger3');
  assert.strictEqual(tag.validate(snapshot), true, 'tag is valid on the second check');
});

test('tracked computed properties are invalidated when their dependencies are invalidated', (assert) => {
  class TrackedPerson {
    @tracked('fullName')
    get salutation() {
      return `Hello, ${this.fullName}!`;
    }

    @tracked('firstName', 'lastName')
    get fullName() {
      return `${this.firstName} ${this.lastName}`;
    }
    set fullName(fullName) {
      let [firstName, lastName] = fullName.split(' ');
      this.firstName = firstName;
      this.lastName = lastName;
    }

    @tracked firstName = 'Tom';
    @tracked lastName = 'Dale';
  }

  let obj = new TrackedPerson();
  assert.strictEqual(obj.salutation, 'Hello, Tom Dale!');
  assert.strictEqual(obj.fullName, 'Tom Dale');

  let tag = tagForProperty(obj, 'salutation');
  let snapshot = tag.value();
  assert.ok(tag.validate(snapshot), 'tag should be valid to start');

  obj.firstName = 'Edsger';
  obj.lastName = 'Dijkstra';
  assert.strictEqual(tag.validate(snapshot), false, 'tag is invalidated after chained dependency is set');
  assert.strictEqual(obj.fullName, 'Edsger Dijkstra');
  assert.strictEqual(obj.salutation, 'Hello, Edsger Dijkstra!');

  snapshot = tag.value();
  assert.strictEqual(tag.validate(snapshot), true);

  obj.fullName = 'Alan Kay';
  assert.strictEqual(tag.validate(snapshot), false, 'tag is invalidated after chained dependency is set');
  assert.strictEqual(obj.fullName, 'Alan Kay');
  assert.strictEqual(obj.firstName, 'Alan');
  assert.strictEqual(obj.lastName, 'Kay');
  assert.strictEqual(obj.salutation, 'Hello, Alan Kay!');

  snapshot = tag.value();
  assert.strictEqual(tag.validate(snapshot), true);
});

module('Tracked Properties - Mandatory @tracked');

if (DEBUG) {
  test('interceptor works correctly for own value descriptor', (assert) => {
    let obj = { name: 'Martin' };

    tagForProperty(obj, 'name');

    assert.strictEqual(obj.name, 'Martin');

    assert.throws(() => {
      obj.name = 'Tom';
    }, UntrackedPropertyError.for(obj, 'name'));
  });

  test('interceptor works correctly for inherited value descriptor', (assert) => {
    class Person { name: string; }
    Person.prototype.name = 'Martin';

    let obj = new Person();

    tagForProperty(obj, 'name');

    assert.strictEqual(obj.name, 'Martin');

    assert.throws(() => {
      obj.name = 'Tom';
    }, UntrackedPropertyError.for(obj, 'name'));
  });

  test('interceptor works correctly for own getter descriptor', (assert) => {
    let obj = {
      get name() {
        return 'Martin';
      }
    };

    tagForProperty(obj, 'name');

    assert.strictEqual(obj.name, 'Martin');

    assert.throws(() => {
      (obj as any).name = 'Tom';
    }, UntrackedPropertyError.for(obj, 'name'));
  });

  test('interceptor works correctly for inherited getter descriptor', (assert) => {
    class Person {
      get name() {
        return 'Martin';
      }
    }

    let obj = new Person();

    tagForProperty(obj, 'name');

    assert.strictEqual(obj.name, 'Martin');

    assert.throws(() => {
      (obj as any).name = 'Tom';
    }, UntrackedPropertyError.for(obj, 'name'));
  });

  test('interceptor works correctly for inherited non-configurable descriptor', (assert) => {
    class Person { name: string; }
    Person.prototype.name = 'Martin';
    Object.defineProperty(Person.prototype, 'name', { configurable: false });

    let obj = new Person();

    tagForProperty(obj, 'name');

    assert.strictEqual(obj.name, 'Martin');

    assert.throws(() => {
      obj.name = 'Tom';
    }, UntrackedPropertyError.for(obj, 'name'));
  });
}

test('interceptor is not installed for own non-configurable descriptor', (assert) => {
  let obj = { name: 'Martin' };
  Object.defineProperty(obj, 'name', { configurable: false });

  tagForProperty(obj, 'name');

  assert.strictEqual(obj.name, 'Martin');

  obj.name = 'Tom';

  assert.strictEqual(obj.name, 'Tom');
});

test('interceptor is not installed for array length [issue #34]', (assert) => {
  let array = [1, 2, 3];

  tagForProperty(array, 'length');

  assert.strictEqual(array.length, 3);

  array.push(4);

  assert.strictEqual(array.length, 4);
});
