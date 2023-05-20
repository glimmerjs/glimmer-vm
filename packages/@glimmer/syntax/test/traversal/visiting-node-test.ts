import type { Optional, OptionalArray } from '@glimmer/interfaces';
import { type AST, preprocess as parse, traverse, type WalkerPath } from '@glimmer/syntax';

const { test } = QUnit;

function traversalEqual(
  node: AST.Node,
  expectedTraversal: Array<[string, AST.BaseNode | undefined]>
) {
  let actualTraversal: Array<[string, AST.BaseNode]> = [];

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
    actualTraversal.map((a) => `${a[0]} ${a[1].type}`),
    expectedTraversal.map((a) => `${a[0]} ${a[1]?.type}`)
  );

  let nodesEqual = true;

  for (let [index, element] of actualTraversal.entries()) {
    if (element?.[1] !== expectedTraversal[index]?.[1]) {
      nodesEqual = false;
      break;
    }
  }

  QUnit.assert.ok(nodesEqual, 'Actual nodes match expected nodes');
}

QUnit.module('[glimmer-syntax] Traversal - visiting');

test('Elements and attributes', function () {
  let ast = parse(
    `<div id="id" class="large {{this.classes}}" value={{this.value}}><b></b><b></b></div>`
  );
  let element = ast.body[0] as AST.ElementNode;
  let concat = element.attributes[1]?.value;
  let concatMustache = getParts(concat)?.[1];
  let attributeMustache = element.attributes[2]?.value;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', element],
    ['enter', element.attributes[0]],
    ['enter', element.attributes[0]?.value],
    ['exit', element.attributes[0]?.value],
    ['exit', element.attributes[0]],
    ['enter', element.attributes[1]],
    ['enter', concat],
    ['enter', getFirstPart(concat)],
    ['exit', getFirstPart(concat)],
    ['enter', concatMustache],
    ['enter', getPath(concatMustache)],
    ['exit', getPath(concatMustache)],
    ['enter', getHash(concatMustache)],
    ['exit', getHash(concatMustache)],
    ['exit', concatMustache],
    ['exit', concat],
    ['exit', element.attributes[1]],
    ['enter', element.attributes[2]],
    ['enter', attributeMustache],
    ['enter', getPath(attributeMustache)],
    ['exit', getPath(attributeMustache)],
    ['enter', getHash(attributeMustache)],
    ['exit', getHash(attributeMustache)],
    ['exit', attributeMustache],
    ['exit', element.attributes[2]],
    ['enter', element.children[0]],
    ['exit', element.children[0]],
    ['enter', element.children[1]],
    ['exit', element.children[1]],
    ['exit', element],
    ['exit', ast],
  ]);
});

test('Element modifiers', function () {
  let ast = parse(`<div {{modifier}}{{modifier param1 param2 key1=value key2=value}}></div>`);
  let element = ast.body[0] as AST.ElementNode;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', element],
    ['enter', element.modifiers[0]],
    ['enter', element.modifiers[0]?.path],
    ['exit', element.modifiers[0]?.path],
    ['enter', element.modifiers[0]?.hash],
    ['exit', element.modifiers[0]?.hash],
    ['exit', element.modifiers[0]],
    ['enter', element.modifiers[1]],
    ['enter', element.modifiers[1]?.path],
    ['exit', element.modifiers[1]?.path],
    ['enter', element.modifiers[1]?.params[0]],
    ['exit', element.modifiers[1]?.params[0]],
    ['enter', element.modifiers[1]?.params[1]],
    ['exit', element.modifiers[1]?.params[1]],
    ['enter', element.modifiers[1]?.hash],
    ['enter', element.modifiers[1]?.hash.pairs[0]],
    ['enter', element.modifiers[1]?.hash.pairs[0]?.value],
    ['exit', element.modifiers[1]?.hash.pairs[0]?.value],
    ['exit', element.modifiers[1]?.hash.pairs[0]],
    ['enter', element.modifiers[1]?.hash.pairs[1]],
    ['enter', element.modifiers[1]?.hash.pairs[1]?.value],
    ['exit', element.modifiers[1]?.hash.pairs[1]?.value],
    ['exit', element.modifiers[1]?.hash.pairs[1]],
    ['exit', element.modifiers[1]?.hash],
    ['exit', element.modifiers[1]],
    ['exit', element],
    ['exit', ast],
  ]);
});

test('Blocks', function () {
  let ast = parse(
    `{{#block}}{{/block}}` +
      `{{#block param1 param2 key1=value key2=value}}<b></b><b></b>{{/block}}`
  );

  let block1 = ast.body[0] as AST.BlockStatement;
  let block2 = ast.body[1] as AST.BlockStatement;

  traversalEqual(ast, [
    ['enter', ast],
    ['enter', block1],
    ['enter', block1.path],
    ['exit', block1.path],
    ['enter', block1.hash],
    ['exit', block1.hash],
    ['enter', block1.program],
    ['exit', block1.program],
    ['exit', block1],
    ['enter', block2],
    ['enter', block2.path],
    ['exit', block2.path],
    ['enter', block2.params[0]],
    ['exit', block2.params[0]],
    ['enter', block2.params[1]],
    ['exit', block2.params[1]],
    ['enter', block2.hash],
    ['enter', block2.hash.pairs[0]],
    ['enter', block2.hash.pairs[0]?.value],
    ['exit', block2.hash.pairs[0]?.value],
    ['exit', block2.hash.pairs[0]],
    ['enter', block2.hash.pairs[1]],
    ['enter', block2.hash.pairs[1]?.value],
    ['exit', block2.hash.pairs[1]?.value],
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

test('Mustaches', function () {
  let ast = parse(`{{mustache}}` + `{{mustache param1 param2 key1=value key2=value}}`);

  let must1 = ast.body[0] as AST.MustacheStatement;
  let must2 = ast.body[1] as AST.MustacheStatement;

  traversalEqual(ast, [
    ['enter', ast],
    ['enter', must1],
    ['enter', must1.path],
    ['exit', must1.path],
    ['enter', must1.hash],
    ['exit', must1.hash],
    ['exit', must1],
    ['enter', must2],
    ['enter', must2.path],
    ['exit', must2.path],
    ['enter', must2.params[0]],
    ['exit', must2.params[0]],
    ['enter', must2.params[1]],
    ['exit', must2.params[1]],
    ['enter', must2.hash],
    ['enter', must2.hash.pairs[0]],
    ['enter', must2.hash.pairs[0]?.value],
    ['exit', must2.hash.pairs[0]?.value],
    ['exit', must2.hash.pairs[0]],
    ['enter', must2.hash.pairs[1]],
    ['enter', must2.hash.pairs[1]?.value],
    ['exit', must2.hash.pairs[1]?.value],
    ['exit', must2.hash.pairs[1]],
    ['exit', must2.hash],
    ['exit', must2],
    ['exit', ast],
  ]);
});

test('Nested helpers', function () {
  let ast = parse(`{{helper
    (helper param1 param2 key1=value key2=value)
    key1=(helper param)
    key2=(helper key=(helper param))
  }}`);

  let must = ast.body[0] as AST.MustacheStatement;
  let sexp = must.params[0] as AST.SubExpression;
  let nestedSexp1 = must.hash.pairs[0]?.value;
  let nestedSexp2 = must.hash.pairs[1]?.value;
  let deeplyNestedSexp = getHash(nestedSexp2)?.pairs[0]?.value;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', must],
    ['enter', must.path],
    ['exit', must.path],
    ['enter', sexp],
    ['enter', sexp.path],
    ['exit', sexp.path],
    ['enter', sexp.params[0]],
    ['exit', sexp.params[0]],
    ['enter', sexp.params[1]],
    ['exit', sexp.params[1]],
    ['enter', sexp.hash],
    ['enter', sexp.hash.pairs[0]],
    ['enter', sexp.hash.pairs[0]?.value],
    ['exit', sexp.hash.pairs[0]?.value],
    ['exit', sexp.hash.pairs[0]],
    ['enter', sexp.hash.pairs[1]],
    ['enter', sexp.hash.pairs[1]?.value],
    ['exit', sexp.hash.pairs[1]?.value],
    ['exit', sexp.hash.pairs[1]],
    ['exit', sexp.hash],
    ['exit', sexp],
    ['enter', must.hash],
    ['enter', must.hash.pairs[0]],
    ['enter', nestedSexp1],
    ['enter', getPath(nestedSexp1)],
    ['exit', getPath(nestedSexp1)],
    ['enter', getParameters(nestedSexp1)?.[0]],
    ['exit', getParameters(nestedSexp1)?.[0]],
    ['enter', getHash(nestedSexp1)],
    ['exit', getHash(nestedSexp1)],
    ['exit', nestedSexp1],
    ['exit', must.hash.pairs[0]],
    ['enter', must.hash.pairs[1]],
    ['enter', nestedSexp2],
    ['enter', getPath(nestedSexp2)],
    ['exit', getPath(nestedSexp2)],
    ['enter', getHash(nestedSexp2)],
    ['enter', getHash(nestedSexp2)?.pairs[0]],
    ['enter', deeplyNestedSexp],
    ['enter', getPath(deeplyNestedSexp)],
    ['exit', getPath(deeplyNestedSexp)],
    ['enter', getParameters(deeplyNestedSexp)?.[0]],
    ['exit', getParameters(deeplyNestedSexp)?.[0]],
    ['enter', getHash(deeplyNestedSexp)],
    ['exit', getHash(deeplyNestedSexp)],
    ['exit', deeplyNestedSexp],
    ['exit', getHash(nestedSexp2)?.pairs[0]],
    ['exit', getHash(nestedSexp2)],
    ['exit', nestedSexp2],
    ['exit', must.hash.pairs[1]],
    ['exit', must.hash],
    ['exit', must],
    ['exit', ast],
  ]);
});

test('Comments', function () {
  let ast = parse(
    `<!-- HTML comment -->{{!-- Handlebars comment --}}<div {{! Other Comment }}></div>`
  );
  let element = ast.body[2] as AST.ElementNode;
  traversalEqual(ast, [
    ['enter', ast],
    ['enter', ast.body[0]],
    ['exit', ast.body[0]],
    ['enter', ast.body[1]],
    ['exit', ast.body[1]],
    ['enter', element],
    ['enter', element.comments[0]],
    ['exit', element.comments[0]],
    ['exit', element],
    ['exit', ast],
  ]);
});

QUnit.module('[glimmer-syntax] Traversal - visiting - paths');

test('Basics', function (assert) {
  let ast = parse(`{{#if foo}}<div>bar</div>{{/if}}`);

  traverse(ast, {
    TextNode(node, path) {
      assert.step('TextNode');
      assert.strictEqual(node.chars, 'bar');
      assert.strictEqual(path.node, node);
      assert.deepEqual(describeFullPath(path), [
        { nodeType: 'Template', key: 'body' },
        { nodeType: 'BlockStatement', key: 'program' },
        { nodeType: 'Block', key: 'body' },
        { nodeType: 'ElementNode', key: 'children' },
        { nodeType: 'TextNode', key: null },
      ]);
    },
  });

  assert.verifySteps(['TextNode']);
});

test('Helper', function (assert) {
  let ast = parse(`{{#foo (bar this.blah)}}{{/foo}}`);

  traverse(ast, {
    PathExpression(node, path) {
      if (node.original === 'this.blah') {
        assert.step('PathExpression this.blah');
        assert.deepEqual(describeFullPath(path), [
          { nodeType: 'Template', key: 'body' },
          { nodeType: 'BlockStatement', key: 'params' },
          { nodeType: 'SubExpression', key: 'params' },
          { nodeType: 'PathExpression', key: null },
        ]);

        assert.notEqual((path.parent!.node as AST.SubExpression).params.indexOf(node), -1);
      }
    },
  });

  assert.verifySteps(['PathExpression this.blah']);
});

test('Modifier', function (assert) {
  let ast = parse(`<div {{foo}}></div>`);

  traverse(ast, {
    PathExpression(node, path) {
      if (node.original === 'foo') {
        assert.step('PathExpression foo');

        assert.deepEqual(describeFullPath(path), [
          { nodeType: 'Template', key: 'body' },
          { nodeType: 'ElementNode', key: 'modifiers' },
          { nodeType: 'ElementModifierStatement', key: 'path' },
          { nodeType: 'PathExpression', key: null },
        ]);

        assert.deepEqual(
          [...path.parents()].map((it) => (it as WalkerPath<AST.Node>).node.type),
          ['ElementModifierStatement', 'ElementNode', 'Template']
        );

        assert.strictEqual((path.parent!.node as AST.ElementModifierStatement).path, node);
      }
    },
  });

  assert.verifySteps(['PathExpression foo']);
});

function describeFullPath(
  path: WalkerPath<AST.Node>
): Array<{ nodeType: string; key: string | null }> {
  let description = [];
  description.push({ nodeType: path.node.type, key: null });

  while (path.parent) {
    description.unshift({ nodeType: path.parent.node.type, key: path.parentKey });
    path = path.parent;
  }

  return description;
}

function getFirstPart(value: AST.AttributeValue | undefined): Optional<AST.AttributePart> {
  let parts = getParts(value);

  if (parts === undefined) return undefined;

  return parts[0];
}

function getParts(value: AST.AttributeValue | undefined): OptionalArray<AST.AttributePart> {
  if (value === undefined) return undefined;

  switch (value.type) {
    case 'ConcatStatement':
      return value.parts;
    case 'MustacheStatement':
    case 'TextNode':
      return [value];
  }
}

function getPath(part: Optional<AST.Expression | AST.AttributeValue>): Optional<AST.Expression> {
  if (part === undefined) return undefined;

  if ('path' in part) {
    return part.path;
  }
}

function getParameters(part: Optional<AST.Expression | AST.AttributeValue>): Optional<AST.Expression[]> {
  if (part === undefined) return undefined;

  if ('params' in part) {
    return part.params;
  }
}

function getHash(part: Optional<AST.Expression | AST.AttributeValue>): Optional<AST.Hash> {
  if (part === undefined) return undefined;

  if ('hash' in part) {
    return part.hash;
  }
}
