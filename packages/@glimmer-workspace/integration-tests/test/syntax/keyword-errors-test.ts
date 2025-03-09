import type { KeywordType } from '@glimmer/syntax';
import { KEYWORDS_TYPES } from '@glimmer/syntax';
import { PackageSuite, verifying } from '@glimmer-workspace/integration-tests';

type KeywordName = keyof typeof KEYWORDS_TYPES;
const TYPES: Record<KeywordName, readonly KeywordType[]> = KEYWORDS_TYPES;
const KEYWORDS = Object.keys(KEYWORDS_TYPES) as KeywordName[];

const BLOCK_KEYWORDS = KEYWORDS.filter((key) => TYPES[key].includes('Block'));
const APPEND_KEYWORDS = KEYWORDS.filter((key) => TYPES[key].includes('Append'));
const CALL_KEYWORDS = KEYWORDS.filter((key) => TYPES[key].includes('Call'));
const MODIFIER_KEYWORDS = KEYWORDS.filter((key) => TYPES[key].includes('Modifier'));

const syntax = PackageSuite('@glimmer/syntax');

for (const keyword of KEYWORDS) {
  syntax(['keyword syntax errors', keyword], (module) => {
    module.test('keyword cannot be used as a value even in non-strict mode', () => {
      verifying(
        `{{some-helper ${keyword}}}`,
        `Attempted to pass \`${keyword}\` as a positional argument, but it was not in scope`,
        { strict: false }
      ).throws`
        1 | {{some-helper ${keyword}}}
          |               ${'='.repeat(keyword.length)}
          |     \== not in scope
      `.errors();
    });

    module.test('keywords can be shadowed by local variables', () => {
      verifying(
        `{{#let this.value as |${keyword}|}}{{some-helper ${keyword}}}{{/let}}`,
        `Attempted to pass \`${keyword}\` as a positional argument, but it was not in scope`,
        { strict: false }
      ).isValid();
    });

    module.test('keywords can be shadowed by local variables', () => {
      verifying(
        `{{#let this.value as |${keyword}|}}{{some-helper ${keyword}}}{{/let}}`,
        `Attempted to pass \`${keyword}\` as a positional argument, but it was not in scope`,
        { strict: true }
      ).isValid();
    });
  });
}

// @basicSuite('glimmer/syntax', 'keyword syntax errors', keyword)
// class KeywordSyntaxErrors {
//   @test

//   @test
//   'keyword can be used as a value in strict mode'() {
//     preprocess(`{{some-helper ${keyword}}}`, {
//       strictMode: true,
//       locals: ['some-helper', keyword],
//       meta: { moduleName: 'test-module' },
//     });
//   }

//   @test
//   'keyword can be yielded as a parameter in other keywords in non-strict mode'() {
//     preprocess(
//       `
//         {{#let this.value as |${keyword}|}}
//           {{some-helper ${keyword}}}
//         {{/let}}
//       `,
//       { meta: { moduleName: 'test-module' } }
//     );
//   }

//   @test
//   'keyword can be yielded as a parameter in other keywords in strict mode'() {
//     preprocess(
//       `
//         {{#let this.value as |${keyword}|}}
//           {{some-helper ${keyword}}}
//         {{/let}}
//       `,
//       { strictMode: true, locals: ['some-helper'], meta: { moduleName: 'test-module' } }
//     );
//   }

//   @test
//   'keyword can be yielded as a parameter in curly invocation in non-strict mode'() {
//     preprocess(
//       `
//         {{#my-component this.value as |${keyword}|}}
//           {{some-helper ${keyword}}}
//         {{/my-component}}
//       `,
//       { meta: { moduleName: 'test-module' } }
//     );
//   }

//   @test
//   'keyword can be yielded as a parameter in curly invocation in strict mode'() {
//     preprocess(
//       `
//         {{#my-component this.value as |${keyword}|}}
//           {{some-helper ${keyword}}}
//         {{/my-component}}
//       `,
//       {
//         strictMode: true,
//         locals: ['my-component', 'some-helper'],
//         meta: { moduleName: 'test-module' },
//       }
//     );
//   }

//   @test
//   'keyword can be yielded as a parameter in component blocks in non-strict mode'() {
//     preprocess(
//       `
//         <SomeComponent as |${keyword}|>
//           {{some-helper ${keyword}}}
//         </SomeComponent>
//       `,
//       { meta: { moduleName: 'test-module' } }
//     );
//   }

//   @test
//   'keyword can be yielded as a parameter in component blocks in strict mode'() {
//     preprocess(
//       `
//         <SomeComponent as |${keyword}|>
//           {{some-helper ${keyword}}}
//         </SomeComponent>
//       `,
//       {
//         strictMode: true,
//         locals: ['SomeComponent', 'some-helper'],
//         meta: { moduleName: 'test-module' },
//       }
//     );
//   }

//   @test
//   'keyword can be yielded as a parameter in component named blocks in non-strict mode'() {
//     preprocess(
//       `
//         <SomeComponent>
//           <:main as |${keyword}|>
//             {{some-helper ${keyword}}}
//           </:main>
//         </SomeComponent>
//       `,
//       { meta: { moduleName: 'test-module' } }
//     );
//   }

//   @test
//   'keyword can be yielded as a parameter in component named blocks in strict mode'() {
//     preprocess(
//       `
//         <SomeComponent>
//           <:main as |${keyword}|>
//             {{some-helper ${keyword}}}
//           </:main>
//         </SomeComponent>
//       `,
//       {
//         strictMode: true,
//         locals: ['SomeComponent', 'some-helper'],
//         meta: { moduleName: 'test-module' },
//       }
//     );
//   }

//   @test
//   'non-block keywords cannot be used as blocks'() {
//     if (BLOCK_KEYWORDS.indexOf(keyword) !== -1) {
//       return;
//     }

//     this.assert.throws(
//       () => {
//         preprocess(`{{#${keyword}}}{{/${keyword}}}`, { meta: { moduleName: 'test-module' } });
//       },
//       new RegExp(
//         `The \`${keyword}\` keyword was used incorrectly. It was used as a block statement, but its valid usages are:`,
//         'u'
//       )
//     );
//   }

//   @test
//   'non-append keywords cannot be used as appends'(assert: Assert) {
//     if (APPEND_KEYWORDS.indexOf(keyword) !== -1) {
//       return;
//     }

//     assert.throws(
//       () => {
//         preprocess(`{{${keyword}}}`, { meta: { moduleName: 'test-module' } });
//       },
//       new RegExp(
//         `The \`${keyword}\` keyword was used incorrectly. It was used as an append statement, but its valid usages are:`,
//         'u'
//       )
//     );
//   }

//   @test
//   'non-expr keywords cannot be used as expr'() {
//     if (CALL_KEYWORDS.indexOf(keyword) !== -1) {
//       return;
//     }

//     this.assert.throws(
//       () => {
//         preprocess(`{{some-helper (${keyword})}}`, { meta: { moduleName: 'test-module' } });
//       },
//       new RegExp(
//         `The \`${keyword}\` keyword was used incorrectly. It was used as a call expression, but its valid usages are:`,
//         'u'
//       )
//     );
//   }

//   @test
//   'non-modifier keywords cannot be used as modifier'() {
//     if (MODIFIER_KEYWORDS.indexOf(keyword) !== -1) {
//       return;
//     }

//     this.assert.throws(
//       () => {
//         preprocess(`<div {{${keyword}}}></div>`, { meta: { moduleName: 'test-module' } });
//       },
//       new RegExp(
//         `The \`${keyword}\` keyword was used incorrectly. It was used as a modifier, but its valid usages are:`,
//         'u'
//       )
//     );
//   }
// }
// }
