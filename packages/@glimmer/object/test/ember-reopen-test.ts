import EmberObject from '@glimmer/object';

function get<T, U extends keyof T>(obj: T, key: U) {
  return obj[key];
}

QUnit.module('GlimmerObject.reopen');

QUnit.test('adds new properties to subclass instance', assert => {
  let Subclass: any = EmberObject.extend();
  Subclass.reopen({
    foo() { return 'FOO'; },
    bar: 'BAR'
  });

  assert.equal(new Subclass()['foo'](), 'FOO', 'Adds method');
  assert.equal(get(new Subclass(), 'bar'), 'BAR', 'Adds property');
});

QUnit.test('reopened properties inherited by subclasses', assert => {
  let Subclass = EmberObject.extend();
  let SubSub: any = Subclass.extend();

  Subclass.reopen({
    foo() { return 'FOO'; },
    bar: 'BAR'
  });

  assert.equal(new SubSub()['foo'](), 'FOO', 'Adds method');
  assert.equal(get(new SubSub(), 'bar'), 'BAR', 'Adds property');
});

QUnit.test('allows reopening already instantiated classes', assert => {
  let Subclass = EmberObject.extend();

  Subclass.create();

  Subclass.reopen({
    trololol: true
  });

  assert.equal(Subclass.create().get('trololol'), true, 'reopen works');
});
