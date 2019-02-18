import { preprocess as parse, traverse, AST } from '@glimmer/syntax';

const { test } = QUnit;

function traversalEqual(node: AST.Node, expectedTraversal: Array<[string, AST.AnyNode]>) {
  let actualTraversal: Array<[string, AST.AnyNode]> = [];

  traverse(node, {
    All: {
      enter(node) {
        actualTraversal.push(['enter', node]);
      },
      exit(node) {
        actualTraversal.push(['exit', node]);
      },
    },
  });

  QUnit.assert.deepEqual(
    actualTraversal.map(a => `${a[0]} ${a[1].type}`),
    expectedTraversal.map(a => `${a[0]} ${a[1].type}`)
  );

  let nodesEqual = true;

  for (let i = 0; i < actualTraversal.length; i++) {
    if (actualTraversal[i][1] !== expectedTraversal[i][1]) {
      nodesEqual = false;
      break;
    }
  }

  QUnit.assert.ok(nodesEqual, 'Actual nodes match expected nodes');
}

QUnit.module('[glimmer-syntax] Traversal - visiting');

test('Elements and attributes', function() {
  let ast = parse(`<div id="id" class="large {{classes}}" value={{value}}><b></b><b></b></div>`);
  let el = ast.body[0] as AST.ElementNode;
  let concat = el.attributes[1].value as AST.ConcatStatement;
  let concatMustache = concat.parts[1] as AST.MustacheStatement;
  let attrMustache = el.attributes[2].value as AST.MustacheStatement;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', el],
    ['enter', el.attributes[0]],
    ['enter', el.attributes[0].value],
    ['exit', el.attributes[0].value],
    ['exit', el.attributes[0]],
    ['enter', el.attributes[1]],
    ['enter', concat],
    ['enter', concat.parts[0]],
    ['exit', concat.parts[0]],
    ['enter', concatMustache],
    ['enter', concatMustache.call],
    ['exit', concatMustache.call],
    ['enter', concatMustache.hash],
    ['exit', concatMustache.hash],
    ['exit', concatMustache],
    ['exit', concat],
    ['exit', el.attributes[1]],
    ['enter', el.attributes[2]],
    ['enter', attrMustache],
    ['enter', attrMustache.call],
    ['exit', attrMustache.call],
    ['enter', attrMustache.hash],
    ['exit', attrMustache.hash],
    ['exit', attrMustache],
    ['exit', el.attributes[2]],
    ['enter', el.children[0]],
    ['exit', el.children[0]],
    ['enter', el.children[1]],
    ['exit', el.children[1]],
    ['exit', el],
    ['exit', ast],
  ]);
});

test('Element modifiers', function() {
  let ast = parse(`<div {{modifier}}{{modifier param1 param2 key1=value key2=value}}></div>`);
  let el = ast.body[0] as AST.ElementNode;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', el],
    ['enter', el.modifiers[0]],
    ['enter', el.modifiers[0].call],
    ['exit', el.modifiers[0].call],
    ['enter', el.modifiers[0].hash],
    ['exit', el.modifiers[0].hash],
    ['exit', el.modifiers[0]],
    ['enter', el.modifiers[1]],
    ['enter', el.modifiers[1].call],
    ['exit', el.modifiers[1].call],
    ['enter', el.modifiers[1].params[0]],
    ['exit', el.modifiers[1].params[0]],
    ['enter', el.modifiers[1].params[1]],
    ['exit', el.modifiers[1].params[1]],
    ['enter', el.modifiers[1].hash],
    ['enter', el.modifiers[1].hash.pairs[0]],
    ['enter', el.modifiers[1].hash.pairs[0].value],
    ['exit', el.modifiers[1].hash.pairs[0].value],
    ['exit', el.modifiers[1].hash.pairs[0]],
    ['enter', el.modifiers[1].hash.pairs[1]],
    ['enter', el.modifiers[1].hash.pairs[1].value],
    ['exit', el.modifiers[1].hash.pairs[1].value],
    ['exit', el.modifiers[1].hash.pairs[1]],
    ['exit', el.modifiers[1].hash],
    ['exit', el.modifiers[1]],
    ['exit', el],
    ['exit', ast],
  ]);
});

test('Blocks', function() {
  let ast = parse(
    `{{#block}}{{/block}}` +
      `{{#block param1 param2 key1=value key2=value}}<b></b><b></b>{{/block}}`
  );

  let block1 = ast.body[0] as AST.BlockStatement;
  let block2 = ast.body[1] as AST.BlockStatement;

  traversalEqual(ast, [
    ['enter', ast],
    ['enter', block1],
    ['enter', block1.call],
    ['exit', block1.call],
    ['enter', block1.hash],
    ['exit', block1.hash],
    ['enter', block1.program],
    ['exit', block1.program],
    ['exit', block1],
    ['enter', block2],
    ['enter', block2.call],
    ['exit', block2.call],
    ['enter', block2.params[0]],
    ['exit', block2.params[0]],
    ['enter', block2.params[1]],
    ['exit', block2.params[1]],
    ['enter', block2.hash],
    ['enter', block2.hash.pairs[0]],
    ['enter', block2.hash.pairs[0].value],
    ['exit', block2.hash.pairs[0].value],
    ['exit', block2.hash.pairs[0]],
    ['enter', block2.hash.pairs[1]],
    ['enter', block2.hash.pairs[1].value],
    ['exit', block2.hash.pairs[1].value],
    ['exit', block2.hash.pairs[1]],
    ['exit', block2.hash],
    ['enter', block2.program],
    ['enter', block2.program.body[0]],
    ['exit', block2.program.body[0]],
    ['enter', block2.program.body[1]],
    ['exit', block2.program.body[1]],
    ['exit', block2.program],
    ['exit', block2],
    ['exit', ast],
  ]);
});

test('Mustaches', function() {
  let ast = parse(`{{mustache}}` + `{{mustache param1 param2 key1=value key2=value}}`);

  let must1 = ast.body[0] as AST.MustacheStatement;
  let must2 = ast.body[1] as AST.MustacheStatement;

  traversalEqual(ast, [
    ['enter', ast],
    ['enter', must1],
    ['enter', must1.call],
    ['exit', must1.call],
    ['enter', must1.hash],
    ['exit', must1.hash],
    ['exit', must1],
    ['enter', must2],
    ['enter', must2.call],
    ['exit', must2.call],
    ['enter', must2.params[0]],
    ['exit', must2.params[0]],
    ['enter', must2.params[1]],
    ['exit', must2.params[1]],
    ['enter', must2.hash],
    ['enter', must2.hash.pairs[0]],
    ['enter', must2.hash.pairs[0].value],
    ['exit', must2.hash.pairs[0].value],
    ['exit', must2.hash.pairs[0]],
    ['enter', must2.hash.pairs[1]],
    ['enter', must2.hash.pairs[1].value],
    ['exit', must2.hash.pairs[1].value],
    ['exit', must2.hash.pairs[1]],
    ['exit', must2.hash],
    ['exit', must2],
    ['exit', ast],
  ]);
});

test('Nested helpers', function() {
  let ast = parse(`{{helper
    (helper param1 param2 key1=value key2=value)
    key1=(helper param)
    key2=(helper key=(helper param))
  }}`);

  let must = ast.body[0] as AST.MustacheStatement;
  let sexp = must.params[0] as AST.SubExpression;
  let nestedSexp1 = must.hash.pairs[0].value as AST.SubExpression;
  let nestedSexp2 = must.hash.pairs[1].value as AST.SubExpression;
  let deeplyNestedSexp = nestedSexp2.hash.pairs[0].value as AST.SubExpression;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', must],
    ['enter', must.call],
    ['exit', must.call],
    ['enter', sexp],
    ['enter', sexp.call],
    ['exit', sexp.call],
    ['enter', sexp.params[0]],
    ['exit', sexp.params[0]],
    ['enter', sexp.params[1]],
    ['exit', sexp.params[1]],
    ['enter', sexp.hash],
    ['enter', sexp.hash.pairs[0]],
    ['enter', sexp.hash.pairs[0].value],
    ['exit', sexp.hash.pairs[0].value],
    ['exit', sexp.hash.pairs[0]],
    ['enter', sexp.hash.pairs[1]],
    ['enter', sexp.hash.pairs[1].value],
    ['exit', sexp.hash.pairs[1].value],
    ['exit', sexp.hash.pairs[1]],
    ['exit', sexp.hash],
    ['exit', sexp],
    ['enter', must.hash],
    ['enter', must.hash.pairs[0]],
    ['enter', nestedSexp1],
    ['enter', nestedSexp1.call],
    ['exit', nestedSexp1.call],
    ['enter', nestedSexp1.params[0]],
    ['exit', nestedSexp1.params[0]],
    ['enter', nestedSexp1.hash],
    ['exit', nestedSexp1.hash],
    ['exit', nestedSexp1],
    ['exit', must.hash.pairs[0]],
    ['enter', must.hash.pairs[1]],
    ['enter', nestedSexp2],
    ['enter', nestedSexp2.call],
    ['exit', nestedSexp2.call],
    ['enter', nestedSexp2.hash],
    ['enter', nestedSexp2.hash.pairs[0]],
    ['enter', deeplyNestedSexp],
    ['enter', deeplyNestedSexp.call],
    ['exit', deeplyNestedSexp.call],
    ['enter', deeplyNestedSexp.params[0]],
    ['exit', deeplyNestedSexp.params[0]],
    ['enter', deeplyNestedSexp.hash],
    ['exit', deeplyNestedSexp.hash],
    ['exit', deeplyNestedSexp],
    ['exit', nestedSexp2.hash.pairs[0]],
    ['exit', nestedSexp2.hash],
    ['exit', nestedSexp2],
    ['exit', must.hash.pairs[1]],
    ['exit', must.hash],
    ['exit', must],
    ['exit', ast],
  ]);
});

test('Comments', function() {
  let ast = parse(
    `<!-- HTML comment -->{{!-- Handlebars comment --}}<div {{! Other Comment }}></div>`
  );
  let el = ast.body[2] as AST.ElementNode;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', ast.body[0]],
    ['exit', ast.body[0]],
    ['enter', ast.body[1]],
    ['exit', ast.body[1]],
    ['enter', el],
    ['enter', el.comments[0]],
    ['exit', el.comments[0]],
    ['exit', el],
    ['exit', ast],
  ]);
});
