/* eslint-disable no-console */
import { createDocument } from 'simple-dom';

import type { Cell } from './lib/utils';

// A runtime wrapper of the compile-time template compiler that ships with Ember.
import { asModule, compile } from './lib/compile-support';
// A simple entry point for creating the Glimmer runtime and rendering a root.
import renderRoot from './lib/core';
// Conveniences for interacting w/ the runtime & tracked values in pure Glimmer.
import { rerender, serialize, tracked } from './lib/utils';

// compile() does:
//
// 1. Preprocess the source with `content-tag`
// 2. Adjust the imports to use core Glimmer imports
let output = await compile(`
  import { Cell } from './lib/utils';

  const h = new Cell('hello');
  const w = new Cell('world');

  export { h, w };

  <template>
    {{~#let h w as |hello world|~}}
      <p>{{hello.current}} {{@kind}} {{world.current}}</p>
    {{~/let~}}
  </template>
`);

// asModule() creates a new module from the output, making its specifiers relative
// to the specified URL (in this case, _this_ file).
const { default: component, h } = await asModule<{ default: object; h: Cell<string> }>(
  output.code,
  { at: import.meta }
);

// This is a Node demo, so we create a SimpleDOM element.
const doc = createDocument();
export const element = doc.createElement('div');

// Set up the args that we will render the component with.
const args = tracked({ kind: 'great' });

// render the component
await renderRoot(component, { element, interactive: false, args });
console.log(serialize(element)); // <div><p>hello great world</p></div>

await rerender(() => (h.current = 'goodbye'));
console.log(serialize(element)); // <div><p>goodbye great world</p></div>

// update one of the arguments
await rerender(() => (args.kind = 'cruel'));
console.log(serialize(element)); // <div><p>goodbye cruel world</p></div>
