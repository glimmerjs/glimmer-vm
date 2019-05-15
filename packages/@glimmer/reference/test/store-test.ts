import { RowReference, Store, compute, VersionedPathReference, Entry } from '@glimmer/reference';

QUnit.module('[@glimmer/reference] store');

QUnit.test('basic CRUD', assert => {
  let store = new Store();

  store.defineSheet({
    name: 'person',
    id: 'column',
    columns: ['first', 'last'],
  });

  let people = store.getSheet('person');

  people.insertRow({
    id: '1',
    first: 'Tom',
    last: 'Dale',
  });

  let tom = people.getRow('1')!;

  assert.ok(tom, 'the row exists');

  assert.equal(
    tom
      .get('data')
      .get('first')
      .value(),
    'Tom'
  );
  assert.equal(
    tom
      .get('data')
      .get('last')
      .value(),
    'Dale'
  );

  people.updateRow({
    id: '1',
    first: 'Thomas',
    last: 'Dale',
  });

  assert.equal(
    tom
      .get('data')
      .get('first')
      .value(),
    'Thomas'
  );
  assert.equal(
    tom
      .get('data')
      .get('last')
      .value(),
    'Dale'
  );
});

QUnit.test('validation', assert => {
  let store = new Store();

  store.defineSheet({
    name: 'person',
    id: 'column',
    columns: ['first', 'last'],
  });

  let people = store.getSheet('person');

  people.insertRow({
    id: '1',
    first: 'Tom',
    last: 'Dale',
  });

  let tom = people.getRow('1')!;
  let tomTag = tom.tag;
  let tomValue = tomTag.value();

  assert.ok(tom, 'the row exists');

  assert.equal(
    tom
      .get('data')
      .get('first')
      .value(),
    'Tom'
  );
  assert.equal(
    tom
      .get('data')
      .get('last')
      .value(),
    'Dale'
  );

  people.updateRow({
    id: '1',
    first: 'Thomas',
    last: 'Dale',
  });

  assert.equal(tomTag.validate(tomValue), false);

  assert.equal(
    tom
      .get('data')
      .get('first')
      .value(),
    'Thomas'
  );
  assert.equal(
    tom
      .get('data')
      .get('last')
      .value(),
    'Dale'
  );
});

QUnit.test('relationships', assert => {
  let store = new Store();

  store.defineSheet({
    name: 'contact',
    id: 'column',
    columns: ['person', 'city'],
  });

  store.defineSheet({
    name: 'person',
    id: 'column',
    columns: ['first', 'last'],
  });

  let contacts = store.getSheet('contact');
  let people = store.getSheet('person');

  let tomRef = people.insertRow({
    id: '1',
    first: 'Tom',
    last: 'Dale',
  });

  let samRef = people.insertRow({
    id: '2',
    first: 'Sam',
    last: 'Selikoff',
  });

  let contactRef = contacts.insertRow({
    id: '1',
    person: tomRef,
    city: 'New York',
  });

  let tom = store.getRow(tomRef)!;
  let contact = store.getRow(contactRef)!;

  assert.ok(contact, 'The contact row exists');

  let contactTag = contact.tag;
  let contactTagValue = contactTag.value();

  // tomContact.person is a row reference -- looking up the row reference produces the same
  // reference as tom
  assert.strictEqual(
    store.getRow(contact
      .get('data')
      .get('person')
      .value() as RowReference),
    tom,
    'looking up a row reference returns the same reference'
  );

  // Update contact 1 with a new person
  contacts.insertRow({
    id: '1',
    person: samRef,
    city: 'New York',
  });

  assert.equal(contactTag.validate(contactTagValue), false, 'The contact is invalidated');

  let sam = store.getRow(samRef);

  // The contact's person has been updated
  assert.strictEqual(
    store.getRow(contact
      .get('data')
      .get('person')
      .value() as RowReference),
    sam
  );
});

QUnit.test('derived state', assert => {
  let store = new Store();

  store.defineSheet({
    name: 'group',
    id: 'column',
    columns: ['people'],
  });

  store.defineSheet({
    name: 'person',
    id: 'column',
    columns: ['first', 'last'],
  });

  let people = store.getSheet('person');
  let groups = store.getSheet('group');

  let adaRef = people.insertRow({
    id: '1',
    first: 'Ada',
    last: 'Lovelace',
  });

  let graceRef = people.insertRow({
    id: '2',
    first: 'Grace',
    last: 'Hopper',
  });

  let groupRef = groups.insertRow({
    id: '1',
    people: [adaRef],
  });

  function peopleNames(groupRef: RowReference) {
    return compute(() => {
      let group = store.getRow(groupRef)!;

      assert.ok(group, 'The group exists');

      let peopleRefs = group
        .get('data')
        .get('people')
        .value() as RowReference[];

      return peopleRefs.map(r => {
        let person = store.getRow(r)!;

        assert.ok(person, 'The referenced person exists');

        let first = person
          .get('data')
          .get('first')
          .value();
        let last = person
          .get('data')
          .get('last')
          .value();

        return `${first} ${last}`;
      });
    });
  }

  let names = peopleNames(groupRef);
  let namesTag = names.tag;
  let namesTagValue = namesTag.value();

  assert.deepEqual(names.value(), ['Ada Lovelace']);

  groups.insertRow({
    id: '1',
    people: [adaRef, graceRef],
  });

  assert.equal(namesTag.validate(namesTagValue), false);

  assert.deepEqual(names.value(), ['Ada Lovelace', 'Grace Hopper']);

  people.insertRow({
    id: '1',
    first: 'Ada',
    last: 'King (of Lovelace)',
  });

  assert.equal(namesTag.validate(namesTagValue), false);

  assert.deepEqual(names.value(), ['Ada King (of Lovelace)', 'Grace Hopper']);
});

QUnit.test('derived inverses', assert => {
  let store = new Store();

  store.defineSheet({
    name: 'group',
    id: 'column',
    columns: ['people'],
  });

  store.defineSheet({
    name: 'person',
    id: 'column',
    columns: ['first', 'last'],
  });

  let people = store.getSheet('person');
  let groups = store.getSheet('group');

  let adaRef = people.insertRow({
    id: '1',
    first: 'Ada',
    last: 'Lovelace',
  });

  let graceRef = people.insertRow({
    id: '2',
    first: 'Grace',
    last: 'Hopper',
  });

  let groupRef = groups.insertRow({
    id: '1',
    people: [adaRef],
  });

  let adaGroup = groupForPerson(adaRef);
  let adaGroupTag = adaGroup.tag;
  let adaGroupTagValue = adaGroupTag.value();

  let graceGroup = groupForPerson(graceRef);
  let graceGroupTag = graceGroup.tag;
  let graceGroupTagValue = graceGroupTag.value();

  assert.deepEqual(adaGroup.value(), groupRef, 'the inverse works when found');
  assert.deepEqual(graceGroup.value(), null, 'inverse is null when not found');

  groups.insertRow({
    id: '1',
    people: [adaRef, graceRef],
  });

  assert.equal(graceGroupTag.validate(graceGroupTagValue), false);
  graceGroupTagValue = graceGroupTag.value();

  assert.deepEqual(adaGroup.value(), groupRef);
  assert.deepEqual(graceGroup.value(), groupRef);

  groups.insertRow({
    id: '1',
    people: [graceRef],
  });

  assert.equal(adaGroupTag.validate(adaGroupTagValue), false);
  adaGroupTagValue = adaGroupTag.value();

  assert.deepEqual(adaGroup.value(), null);
  assert.deepEqual(graceGroup.value(), groupRef);

  function groupForPerson(personRef: RowReference): VersionedPathReference {
    return compute(() => {
      let allGroups = groups.allRows().value();

      let group = allGroups.find(g => {
        let people = g
          .get('data')
          .get('people')
          .value() as RowReference[];

        return people.some(p => p.id[0] === personRef.id[0]);
      })!;

      return group ? groups.getRowReference(group.value() as Entry) : null;
    });
  }
});
