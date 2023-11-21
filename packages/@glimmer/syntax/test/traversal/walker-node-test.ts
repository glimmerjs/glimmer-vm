import { preprocess as parse, Walker } from '@glimmer/syntax';

function compareWalkedNodes(html: string, expected: string[]) {
  let ast = parse(html);
  let walker = new Walker();
  let nodes: string[] = [];

  walker.visit(ast, (node) => {
    nodes.push(node.type);
  });

  QUnit.assert.deepEqual(nodes, expected);
}

QUnit.module('[glimmer-syntax] (Legacy) Traversal - Walker');

QUnit.test('walks elements', () => {
  compareWalkedNodes('<div><li></li></div>', ['Template', 'ElementNode', 'ElementNode']);
});

QUnit.test('walks blocks', () => {
  compareWalkedNodes('{{#foo}}<li></li>{{/foo}}', [
    'Template',
    'BlockStatement',
    'Block',
    'ElementNode',
  ]);
});
