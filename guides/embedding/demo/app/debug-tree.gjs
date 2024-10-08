import { setModifierManager, modifierCapabilities } from '@glimmer/manager';

const overlay = document.querySelector('#overlay');

<template>
  {{#in-element overlay}}
  {{/in-element}}
  <pre class="debug">
    {{#each @roots.current as |root|}}
      {{#if (eq root.type "component")}}
        <Component @component={{root}} @indent={{0}} />
      {{/if}}
    {{/each}}
  </pre>
  <ul>
  {{#each @roots as |root|}}
    <li><pre>{{format root indent=2}}</pre></li>
  {{/each}}
  </ul>
</template>

const Component = <template>
{{indent @indent}}&lt;<span class="name" {{on "mouseenter" (fn enterbounds @component)}} {{on "mouseleave" (fn leavebounds @component)}}>Component</span>
{{~#each (entries @component.args.named) as |entry|~}}
  &#32;<span class="key">@{{entry.key}}</span><span class="punct">{{"="}}</span><span class="value">{{format entry.value indent=2}}</span>
{{~/each~}}
{{~if @component.children.length ">" " />"~}}
{{~#if @component.children.length~}}
{{~#each @component.children as |child|~}}
  <Component @component={{child}} @indent={{increment @indent}} />
{{~/each~}}
{{newline}}{{indent @indent}}&lt;/<span class="name">Component</span>&gt;
{{~/if~}}
</template>

const newline = "\n";

const enterbounds = (component, e) => {
  const bounds = component.bounds;
  const range = document.createRange();
  range.setStartBefore(bounds.firstNode);
  range.setEndAfter(bounds.lastNode);

  const rect = range.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
}

const leavebounds = (...args) => {
  overlay.style.display = 'none';
}

const indent = (n) => '  '.repeat(n);
const increment = (n) => n + 1;

const entries = (obj) => Object.entries(obj).map(([key, value]) => ({ key, value }));

const eq = (a, b) => a === b;

const format = (obj, options = {}) => JSON.stringify(obj, null, options.indent ?? undefined);

class on {}

setModifierManager(
  () => ({
    capabilities: modifierCapabilities('3.22'),
    createModifier() {
      return new on();
    },
    installModifier(_, e, {positional: [event, listener]}) {
      e.addEventListener(event, listener)
    },
    updateModifier() {},
    destroyModifier() {},
  }),
  on
);

function fn(block, ...args) {
  return block.bind(undefined, ...args);
}
