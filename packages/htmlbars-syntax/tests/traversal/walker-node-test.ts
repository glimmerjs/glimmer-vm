import { parse, Walker } from '../../htmlbars-syntax';

function compareWalkedNodes(html, expected) {
  let ast = parse(html);
  let walker = new Walker();
  let nodes = [];

  walker.visit(ast, function(node) {
    nodes.push(node.type);
  });

  deepEqual(nodes, expected);
}

QUnit.module('[htmlbars-syntax] (Legacy) Traversal - Walker');

test('walks elements', function() {
  compareWalkedNodes('<div><li></li></div>', [
    'Program',
    'ElementNode',
    'ElementNode'
  ]);
});

test('walks blocks', function() {
  compareWalkedNodes('{{#foo}}<li></li>{{/foo}}', [
    'Program',
    'BlockStatement',
    'Program',
    'ElementNode'
  ]);
});

test('walks components', function() {
  compareWalkedNodes('<my-foo><li></li></my-foo>', [
    'Program',
    'ComponentNode',
    'Program',
    'ElementNode'
  ]);
});
