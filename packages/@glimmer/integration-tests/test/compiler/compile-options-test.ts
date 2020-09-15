import { precompile } from '@glimmer/compiler';
import { preprocess, DEFAULT_TEST_META } from '../..';
import { module } from '../support';
import { assign, unwrapTemplate, assert as glimmerAssert } from '@glimmer/util';
import { SexpOpcodes, WireFormat } from '@glimmer/interfaces';

module('[glimmer-compiler] Compile options', ({ test }) => {
  test('moduleName option is passed into meta', (assert) => {
    let moduleName = "It ain't hard to tell";
    let template = unwrapTemplate(
      preprocess('Hi, {{name}}!', assign({}, DEFAULT_TEST_META, { module: moduleName }))
    );
    assert.equal(template.referrer.module, moduleName, 'Template has the moduleName');
  });
});

module('[glimmer-compiler] precompile', ({ test }) => {
  test('returned meta is correct', (assert) => {
    let wire = JSON.parse(
      precompile('Hi, {{name}}!', {
        meta: {
          moduleName: 'my/module-name',
          metaIsunknown: 'yes',
        },
      })
    );

    assert.equal(wire.meta.moduleName, 'my/module-name', 'Template has correct meta');
    assert.equal(wire.meta.metaIsunknown, 'yes', 'Template has correct meta');
  });

  test('customizeComponentName is used if present', function (assert) {
    let wire = JSON.parse(
      precompile('<XFoo />', {
        meta: {
          moduleName: 'my/module-name',
          metaIsunknown: 'yes',
        },
        customizeComponentName(input: string) {
          return input.split('').reverse().join('');
        },
      })
    );

    let block: WireFormat.SerializedTemplateBlock = JSON.parse(wire.block);
    let [[, componentNameExpr]] = block.statements as [WireFormat.Statements.Component];

    glimmerAssert(
      Array.isArray(componentNameExpr) &&
        componentNameExpr[0] === SexpOpcodes.GetFreeAsComponentHead,
      `component name is a free variable lookup`
    );

    let componentName = block.upvars[componentNameExpr[1]];
    assert.equal(componentName, 'ooFX', 'customized component name was used');
  });
});
