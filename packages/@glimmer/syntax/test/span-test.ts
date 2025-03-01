import type { Nullable } from '@glimmer/interfaces';
import { src } from '@glimmer/syntax';

const { module, test } = QUnit;

const source = src.Source.from('hello world');

module('[glimmer-syntax] SourceSpan', () => {
  module('intersect', () => {
    test('disjoint', () => {
      testIntersect([0, 5], [6, 11], null);
    });

    test('same', () => {
      testIntersect([0, 5], [0, 5], [0, 5]);
    });

    test('contained', () => {
      // fully contained
      testIntersect([0, 5], [1, 4], [1, 4]);
      // same at start, contained at end
      testIntersect([1, 6], [1, 4], [1, 4]);
      // same at end, contained at start
      testIntersect([1, 6], [2, 6], [2, 6]);
    });

    test('overlapping', () => {
      // subset of both start and end
      testIntersect([1, 4], [2, 6], [2, 4]);
      // subset of end
      testIntersect([1, 4], [1, 6], [1, 4]);
    });
  });
});

function testIntersect(
  a: [start: number, end: number],
  b: [start: number, end: number],
  expected: Nullable<[start: number, end: number]>
) {
  const aDesc = `${String(a[0])}..${String(a[1])}`;
  const bDesc = `${String(b[0])}..${String(b[1])}`;

  const aSpan = source.offsetSpan({ start: a[0], end: a[1] });
  const bSpan = source.offsetSpan({ start: b[0], end: b[1] });
  const expectedSpan = expected && source.offsetSpan({ start: expected[0], end: expected[1] });

  equalSpan(aSpan.intersect(bSpan), expectedSpan, `${aDesc} intersect ${bDesc}`);
  equalSpan(bSpan.intersect(aSpan), expectedSpan, `${bDesc} intersect ${aDesc}`);
}

function equalSpan(a: src.SourceSpan | null, b: src.SourceSpan | null, message: string) {
  QUnit.assert.deepEqual(a?.offsetString, b?.offsetString, message);
}

export {};
