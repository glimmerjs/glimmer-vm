/* eslint-disable no-console */
import * as global from '@glimmer/global-context';
import * as opcodes from '@glimmer/opcode-compiler';
import * as program from '@glimmer/program';
import * as rt from '@glimmer/runtime';
import createDocument from '@simple-dom/document';

import type { Cell } from './lib/utils';

// A runtime wrapper of the compile-time template compiler that ships with Ember.
import { asModule, compile } from './lib/compiler';
// A simple entry point for creating the Glimmer runtime and rendering a root.
import { GlimmerRuntime } from './lib/core';
// Conveniences for interacting w/ the runtime & tracked values in pure Glimmer.
import { serialize, tracked } from './lib/utils';

const runtime = GlimmerRuntime.enable({
  document: createDocument(),
  deps: { program, runtime: rt, opcodes, global },
});

// compile() does:
//
// 1. Preprocess the source with `content-tag`
// 2. Adjust the imports to use core Glimmer imports
let output = await compile(/*ts*/ `
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
await runtime.renderRoot(component, { element, interactive: false, args });
console.log(serialize(element)); // <div><p>hello great world</p></div>

h.current = 'goodbye';
await runtime.didRender();
console.log(serialize(element)); // <div><p>goodbye great world</p></div>

// update one of the arguments
args.kind = 'cruel';
await runtime.didRender();
console.log(serialize(element)); // <div><p>goodbye cruel world</p></div>
