import { KEYWORDS_TYPES } from '@glimmer/syntax';
import { PackageSuite, verifying } from '@glimmer-workspace/integration-tests';

type KeywordName = keyof typeof KEYWORDS_TYPES;
const KEYWORDS = Object.keys(KEYWORDS_TYPES) as KeywordName[];

const syntax = PackageSuite('@glimmer/syntax');

for (const keyword of KEYWORDS) {
  syntax(['keyword syntax errors', keyword], (module) => {
    module.test('keyword cannot be used as a value even in non-strict mode', () => {
      verifying(
        `{{someHelper ${keyword}}}`,
        `Attempted to pass \`${keyword}\` as a positional argument, but it was not in scope`,
        { lexicalScope: (name) => name === 'someHelper' }
      ).throws`
        1 | {{someHelper ${keyword}}}
          |              ${'='.repeat(keyword.length)}
          |                 \==== not in scope
      `.errors();
    });

    module.test('keywords can be shadowed by local variables', () => {
      verifying(`{{#let this.value as |${keyword}|}}{{someHelper ${keyword}}}{{/let}}`, {
        lexicalScope: (name) => name === 'someHelper',
      }).isValid();

      verifying(
        `{{#someComponent this.value as |${keyword}|}}{{someHelper ${keyword}}}{{/someComponent}}`,
        { lexicalScope: (name) => name === 'someHelper' || name === 'someComponent' }
      ).isValid();
    });
  });
}
