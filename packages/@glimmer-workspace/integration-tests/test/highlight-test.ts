import {
  assertParts,
  Count,
  spansForParts,
  test,
  testSuite,
} from '@glimmer-workspace/integration-tests';

@testSuite('Test Utils: Highlight')
export class HighlightTest {
  readonly count = new Count();

  @test
  'highlight primary only'() {
    const spans = spansForParts('<div>{{', 'hello');

    assertParts(
      'without label',
      `
        1 | <div>{{hello}}</div>
          |        =====
      `,
      {
        line: '1',
        content: '<div>{{hello}}</div>',
        primary: { loc: spans.primary },
      }
    );

    assertParts(
      'with label',
      `
        1 | <div>{{hello}}</div>
          |        =====
          |          ======= inner
      `,
      {
        line: '1',
        content: '<div>{{hello}}</div>',
        primary: { loc: spans.primary, label: 'inner' },
      }
    );
  }

  @test
  'highlight expanded with prefix and suffix'() {
    const spans = spansForParts('<div>', '{{', 'hello', '}}');

    assertParts(
      'with both labels',
      `
        1 | <div>{{hello}}</div>
          |      --=====--
          |          ======= inner
          |       ---------- outer
      `,
      {
        line: '1',
        content: '<div>{{hello}}</div>',
        primary: { loc: spans.primary, label: 'inner' },
        expanded: { loc: spans.expanded, label: 'outer' },
      }
    );

    assertParts(
      'with primary label',
      `
        1 | <div>{{hello}}</div>
          |      --=====--
          |          ======= inner
      `,
      {
        line: '1',
        content: '<div>{{hello}}</div>',
        primary: { loc: spans.primary, label: 'inner' },
        expanded: { loc: spans.expanded },
      }
    );

    assertParts(
      'with expanded label',
      `
        1 | <div>{{hello}}</div>
          |      --=====--
          |       ---------- outer
      `,
      {
        line: '1',
        content: '<div>{{hello}}</div>',
        primary: { loc: spans.primary },
        expanded: { loc: spans.expanded, label: 'outer' },
      }
    );

    assertParts(
      'with no labels',
      `
        1 | <div>{{hello}}</div>
          |      --=====--
      `,
      {
        line: '1',
        content: '<div>{{hello}}</div>',
        primary: { loc: spans.primary },
        expanded: { loc: spans.expanded },
      }
    );
  }

  @test
  'highlight expanded with prefix but no suffix'() {
    const spans = spansForParts('<div>{{', '=[ x ]', '-[ .hello ]');

    assertParts(
      'with both labels',
      `
        1 | <div>{{x.hello}}</div>
          |        =------
          |          ------- path
          |        ========= variable
      `,
      {
        line: '1',
        content: '<div>{{x.hello}}</div>',
        primary: { loc: spans.primary, label: 'variable' },
        expanded: { loc: spans.expanded, label: 'path' },
      }
    );

    assertParts(
      'with primary label',
      `
        1 | <div>{{x.hello}}</div>
          |        =------
          |        ======= variable
      `,
      {
        line: '1',
        content: '<div>{{x.hello}}</div>',
        primary: { loc: spans.primary, label: 'variable' },
        expanded: { loc: spans.expanded },
      }
    );

    assertParts(
      'with expanded label',
      `
        1 | <div>{{x.hello}}</div>
          |        =------
          |           ---------- path
      `,
      {
        line: '1',
        content: '<div>{{x.hello}}</div>',
        primary: { loc: spans.primary },
        expanded: { loc: spans.expanded, label: 'path' },
      }
    );

    assertParts(
      'with no labels',
      `
        1 | <div>{{x.hello}}</div>
          |        =------
      `,
      {
        line: '1',
        content: '<div>{{x.hello}}</div>',
        primary: { loc: spans.primary },
        expanded: { loc: spans.expanded },
      }
    );
  }
}
