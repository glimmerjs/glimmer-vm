import { assertParts, PackageSuite, spansForParts } from '@glimmer-workspace/integration-tests';

const syntax = PackageSuite('@glimmer/syntax');

syntax(['Test Utils: Highlight'], (module) =>
  module.test('highlight primary only', () => {
    const spans = spansForParts(['<div>{{', 'hello']);

    assertParts(
      'without label',
      `
        1 | <div>{{hello}}</div>
          |        =====
      `,
      {
        lineno: 1,
        content: '<div>{{hello}}</div>',
        message: undefined,
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
        lineno: 1,
        content: '<div>{{hello}}</div>',
        message: undefined,
        primary: { loc: spans.primary, label: 'inner' },
      }
    );
  })
);

// @basicSuite('@glimmer/syntax', 'Test Utils: Highlight')
// export class HighlightTest {
//   @test
//   'highlight primary only'() {}

//   @test
//   'highlight primary only (not line 1)'() {
//     const spans = spansForParts(['<div>{{', 'hello']);

//     assertParts(
//       'without label',
//       `
//         3 | <div>{{hello}}</div>
//           |        =====
//       `,
//       {
//         lineno: 3,
//         content: '<div>{{hello}}</div>',
//         primary: { loc: spans.primary },
//       }
//     );

//     assertParts(
//       'with label',
//       `
//         3 | <div>{{hello}}</div>
//           |        =====
//           |          ======= inner
//       `,
//       {
//         lineno: 3,
//         content: '<div>{{hello}}</div>',
//         primary: { loc: spans.primary, label: 'inner' },
//       }
//     );
//   }

//   @test
//   'highlight expanded with prefix and suffix'() {
//     const spans = spansForParts(['<div>', '{{', 'hello', '}}']);

//     assertParts(
//       'with both labels',
//       `
//         1 | <div>{{hello}}</div>
//           |      --=====--
//           |          ======= inner
//           |       ---------- outer
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{hello}}</div>',
//         primary: { loc: spans.primary, label: 'inner' },
//         expanded: { loc: spans.expanded, label: 'outer' },
//       }
//     );

//     assertParts(
//       'with primary label',
//       `
//         1 | <div>{{hello}}</div>
//           |      --=====--
//           |          ======= inner
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{hello}}</div>',
//         primary: { loc: spans.primary, label: 'inner' },
//         expanded: { loc: spans.expanded },
//       }
//     );

//     assertParts(
//       'with expanded label',
//       `
//         1 | <div>{{hello}}</div>
//           |      --=====--
//           |       ---------- outer
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{hello}}</div>',
//         primary: { loc: spans.primary },
//         expanded: { loc: spans.expanded, label: 'outer' },
//       }
//     );

//     assertParts(
//       'with no labels',
//       `
//         1 | <div>{{hello}}</div>
//           |      --=====--
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{hello}}</div>',
//         primary: { loc: spans.primary },
//         expanded: { loc: spans.expanded },
//       }
//     );
//   }

//   @test
//   'highlight expanded with prefix but no suffix'() {
//     const spans = spansForParts(['<div>{{', '=[ x ]', '-[ .hello ]']);

//     assertParts(
//       'with both labels',
//       `
//         1 | <div>{{x.hello}}</div>
//           |        =------
//           |          ------- path
//           |        ========= variable
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{x.hello}}</div>',
//         primary: { loc: spans.primary, label: 'variable' },
//         expanded: { loc: spans.expanded, label: 'path' },
//       }
//     );

//     assertParts(
//       'with primary label',
//       `
//         1 | <div>{{x.hello}}</div>
//           |        =------
//           |        ======= variable
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{x.hello}}</div>',
//         primary: { loc: spans.primary, label: 'variable' },
//         expanded: { loc: spans.expanded },
//       }
//     );

//     assertParts(
//       'with expanded label',
//       `
//         1 | <div>{{x.hello}}</div>
//           |        =------
//           |           ---------- path
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{x.hello}}</div>',
//         primary: { loc: spans.primary },
//         expanded: { loc: spans.expanded, label: 'path' },
//       }
//     );

//     assertParts(
//       'with no labels',
//       `
//         1 | <div>{{x.hello}}</div>
//           |        =------
//       `,
//       {
//         lineno: 1,
//         content: '<div>{{x.hello}}</div>',
//         primary: { loc: spans.primary },
//         expanded: { loc: spans.expanded },
//       }
//     );
//   }
// }
