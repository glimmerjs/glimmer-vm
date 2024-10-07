// A runtime wrapper of the compile-time template compiler that ships with Ember.
// Conveniences for interacting w/ the runtime & tracked values in pure Glimmer.
import * as global from '@glimmer/global-context';
import * as opcodes from '@glimmer/opcode-compiler';
import * as program from '@glimmer/program';
import * as rt from '@glimmer/runtime';

import type { Cell } from './lib/utils';

import { asModule, compile } from './lib/compile-support';
// A simple entry point for creating the Glimmer runtime and rendering a root.
import { GlimmerRuntime } from './lib/core';
import { tracked } from './lib/utils';

const runtime = GlimmerRuntime.enable({
  document,
  deps: { program, runtime: rt, opcodes, global },
});

// compile() does:
//
// 1. Preprocess the source with `content-tag`
// 2. Adjust the imports to use core Glimmer imports
let output = await compile(/*ts*/ `
  import { Cell } from '@/lib/utils.ts';

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

export const element = document.createElement('div');
document.body.appendChild(element);

// Set up the args that we will render the component with.
const args = tracked({ kind: 'great' });

// render the component
await runtime.renderRoot(component, { element, interactive: false, args });
await delay(1000);

h.current = 'goodbye';
await runtime.didRender();
await delay(1000);

// update one of the arguments
args.kind = 'cruel';
await runtime.didRender();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
