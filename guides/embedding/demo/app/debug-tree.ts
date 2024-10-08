import { asModule, compile } from '../lib/compiler';
import tree from './debug-tree.gjs?raw';

const renderTree = await compile(tree);

const { default: RenderTree } = await asModule<{ default: object }>(renderTree.code, {
  at: import.meta,
});

export default RenderTree;
