import './app/app.css';

import * as global from '@glimmer/global-context';
import * as opcodes from '@glimmer/opcode-compiler';
import * as program from '@glimmer/program';
import * as rt from '@glimmer/runtime';

import RenderTree from './app/debug-tree';
import { asModule, compile } from './lib/compiler';
// A simple entry point for creating the Glimmer runtime and rendering a root.
import { GlimmerRuntime } from './lib/core';
import { Cell, tracked } from './lib/utils';

const runtime = GlimmerRuntime.enable({
  document,
  deps: { program, runtime: rt, opcodes, global },
});

/**
 * Compile the template into Glimmer code
 *
 * 1. Preprocess the source with `content-tag`
 * 2. Adjust the imports to use core Glimmer imports
 */
const output = await compile(
  `
  import { Cell } from '@/lib/utils.ts';

  const h = new Cell('hello');
  const w = new Cell('world');

  export { h, w };

  <template>
  {{~#let h w as |hello world|~}}
    <p><Paragraph @hello={{hello.current}} @kind={{@kind}} @world={{world.current}} /></p>
  {{~/let~}}
  </template>

  const Paragraph = <template>
    <p>
      <Word @word={{@hello}} />
      <Word @word={{@kind}} />
      <Word @word={{@world}} />
    </p>
  </template>

  const Word = <template>
    <span>{{@word}}</span>
  </template>
`,
  { filename: `app.gjs` }
);

// asModule() creates a new module from the output, and evaluates it.
//
// In the browser, this is done by creating a blob and `import()`ing it.
// Since this is running in vite, import maps in the HTML file allow us
// to use the glimmer packages in the repo.
const { default: component, h } = await asModule<{ default: object; h: Cell<string> }>(
  output.code,
  { at: import.meta }
);

export const element = document.createElement('div');
document.body.appendChild(element);

// Set up the args that we will render the component with.
const args = tracked({ kind: 'great' });

// render the component
const root = await runtime.renderRoot(component, {
  element,
  debug: true,
  interactive: false,
  args,
});

const tree = root.env.debugRenderTree;
const treeArg = new Cell(tree?.capture());

async function renderDebugTree() {
  treeArg.current = tree?.capture();
  await runtime.didRender();
}

const debugElement = document.createElement('div');
document.body.appendChild(debugElement);

await runtime.renderRoot(RenderTree, {
  element: debugElement,
  debug: false,
  interactive: true,
  args: { roots: treeArg },
});

await delay(1000);

h.current = 'goodbye';
await runtime.didRender();
await renderDebugTree();
await delay(1000);

// update one of the arguments
args.kind = 'cruel';
await runtime.didRender();
await renderDebugTree();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
