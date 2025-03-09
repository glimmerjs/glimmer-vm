import { PackageSuite, verifying } from '@glimmer-workspace/integration-tests';

const types = ['if', 'unless'];

const syntax = PackageSuite('@glimmer/compiler');

for (const type of types) {
  syntax([`keyword syntax errors`, type], (module) =>
    module.test(`{{#${type}}} throws if it received named args`, () => {
      const padd = ' '.repeat(type.length);

      verifying(
        `{{#${type} condition=true}}{{/${type}}}`,
        `{{#${type}}} cannot receive named parameters, received \`condition\``,
        { strict: 'both', using: 'compiler' }
      ).throws`
        1 | {{#${type} condition=true}}{{/${type}}}
          |    ${padd} =========-----
          |              \=== invalid
      `.errors();
    })
  );
}
//   @basicSuite(`glimmer/syntax`, `keyword syntax errors`, type)
//   class SyntaxErrors {
//     @test
//     [`{{#${type}}} throws if it received named args`](assert: Assert) {
//     }

//     @test
//     [`{{#${type}}} throws if it received no positional params`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{#${type}}}{{/${type}}}`, { meta: { moduleName: 'test-module' } });
//         },
//         syntaxErrorFor(
//           `{{#${type}}} requires a condition as its first positional parameter, did not receive any parameters`,
//           `{{#${type}}}{{/${type}}}`,
//           'test-module',
//           1,
//           0
//         )
//       );
//     }

//     @test
//     [`{{#${type}}} throws if it received more than one positional param`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{#${type} true false}}{{/${type}}}`, {
//             meta: { moduleName: 'test-module' },
//           });
//         },
//         syntaxErrorFor(
//           `{{#${type}}} can only receive one positional parameter in block form, the conditional value. Received 2 parameters`,
//           `{{#${type} true false}}{{/${type}}}`,
//           'test-module',
//           1,
//           0
//         )
//       );
//     }

//     @test
//     [`{{${type}}} throws if it received named args`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{#${type} condition=true}}{{/${type}}}`, {
//             meta: { moduleName: 'test-module' },
//           });
//         },
//         highlightError(`{{#${type}}} cannot receive named parameters, received condition`)`
//           1 | {{#${type} condition=true}}{{/${type}}}
//             | ==
//         `
//       );
//     }

//     @test
//     [`{{${type}}} throws if it received no positional params`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{${type}}}`, { meta: { moduleName: 'test-module' } });
//         },
//         syntaxErrorFor(
//           `When used inline, (${type}) requires at least two parameters 1. the condition that determines the state of the (${type}), and 2. the value to return if the condition is ${
//             type === 'if' ? 'true' : 'false'
//           }. Did not receive any parameters`,
//           `{{${type}}}`,
//           'test-module',
//           1,
//           0
//         )
//       );
//     }

//     @test
//     [`{{${type}}} throws if it received only one positional param`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{${type} true}}`, { meta: { moduleName: 'test-module' } });
//         },
//         syntaxErrorFor(
//           `When used inline, (${type}) requires at least two parameters 1. the condition that determines the state of the (${type}), and 2. the value to return if the condition is ${
//             type === 'if' ? 'true' : 'false'
//           }. Received only one parameter, the condition`,
//           `{{${type} true}}`,
//           'test-module',
//           1,
//           0
//         )
//       );
//     }

//     @test
//     [`{{${type}}} throws if it received more than 3 positional params`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{${type} true false true false}}`, { meta: { moduleName: 'test-module' } });
//         },
//         syntaxErrorFor(
//           `When used inline, (${type}) can receive a maximum of three positional parameters 1. the condition that determines the state of the (${type}), 2. the value to return if the condition is ${
//             type === 'if' ? 'true' : 'false'
//           }, and 3. the value to return if the condition is ${
//             type === 'if' ? 'false' : 'true'
//           }. Received 4 parameters`,
//           `{{${type} true false true false}}`,
//           'test-module',
//           1,
//           0
//         )
//       );
//     }

//     @test
//     [`(${type}) throws if it received named args`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{foo (${type} condition=true)}}`, {
//             meta: { moduleName: 'test-module' },
//           });
//         },
//         highlightError(`{{#${type}}} cannot receive named parameters, received condition`)`
//           1 | {{#${type} condition=true}}{{/${type}}}
//             |            =========
//         `
//       );
//     }

//     @test
//     [`(${type}) throws if it received no positional params`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{foo (${type})}}`, { meta: { moduleName: 'test-module' } });
//         },
//         syntaxErrorFor(
//           `When used inline, (${type}) requires at least two parameters 1. the condition that determines the state of the (${type}), and 2. the value to return if the condition is ${
//             type === 'if' ? 'true' : 'false'
//           }. Did not receive any parameters`,
//           `(${type})`,
//           'test-module',
//           1,
//           6
//         )
//       );
//     }

//     @test
//     [`(${type}) throws if it received only one positional param`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{foo (${type} true)}}`, { meta: { moduleName: 'test-module' } });
//         },
//         syntaxErrorFor(
//           `When used inline, (${type}) requires at least two parameters 1. the condition that determines the state of the (${type}), and 2. the value to return if the condition is ${
//             type === 'if' ? 'true' : 'false'
//           }. Received only one parameter, the condition`,
//           `(${type} true)`,
//           'test-module',
//           1,
//           6
//         )
//       );
//     }

//     @test
//     [`(${type}) throws if it received more than 3 positional params`](assert: Assert) {
//       assert.throws(
//         () => {
//           preprocess(`{{foo (${type} true false true false)}}`, {
//             meta: { moduleName: 'test-module' },
//           });
//         },
//         syntaxErrorFor(
//           `When used inline, (${type}) can receive a maximum of three positional parameters 1. the condition that determines the state of the (${type}), 2. the value to return if the condition is ${
//             type === 'if' ? 'true' : 'false'
//           }, and 3. the value to return if the condition is ${
//             type === 'if' ? 'false' : 'true'
//           }. Received 4 parameters`,
//           `(${type} true false true false)`,
//           'test-module',
//           1,
//           6
//         )
//       );
//     }
//   }
// }
