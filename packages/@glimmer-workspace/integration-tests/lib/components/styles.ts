import { InvocationBuilder } from './build';
import { type ComponentBlueprint, CURLY_TEST_COMPONENT, GLIMMER_TEST_COMPONENT } from './types';

export type ComponentStyle = (blueprint: ComponentBlueprint) => {
  // the name of the template
  name: string;
  template: string;
  invocation: string;
};

export type BuildTemplate = (blueprint: ComponentBlueprint) => string;

export type BuildInvocation = (blueprint: ComponentBlueprint) => {
  invocation: string;
  name: string;
};

const AngleBracketStyle = ((blueprint: ComponentBlueprint) => {
  let {
    args = {},
    attributes = {},
    template,
    name = GLIMMER_TEST_COMPONENT,
    else: elseBlock,
    blockParams = [],
  } = blueprint;

  const builder = InvocationBuilder.ANGLE;

  let invocation: string | string[] = [];

  invocation.push(`<${name}`);

  let componentArgs = builder.args(args);

  if (componentArgs !== '') {
    invocation.push(componentArgs);
  }

  let attrs = builder.attributes(attributes);
  if (attrs !== '') {
    invocation.push(attrs);
  }

  let open = invocation.join(' ');
  invocation = [open];

  if (template) {
    let block: string | string[] = [];
    let params = builder.blockParams(blockParams);

    if (elseBlock) {
      block.push(`><:default${params}>${template}</:default><:else>${elseBlock}</:else>`);
    } else {
      block.push(`${params}>${template}`);
    }

    block.push(`</${name}>`);
    invocation.push(block.join(''));
  } else {
    invocation.push(' ');
    invocation.push(`/>`);
  }

  return { name, invocation: invocation.join('') };
}) satisfies BuildInvocation;

export const BuildGlimmerInvoke = (blueprint: ComponentBlueprint) => {
  return AngleBracketStyle(blueprint);
};

export const BuildGlimmerTemplate = (blueprint: ComponentBlueprint) => {
  let { tag = 'div', layout } = blueprint;
  const builder = InvocationBuilder.ANGLE;

  let layoutAttrs = builder.attributes(blueprint.layoutAttributes);

  return layout.includes(`...attributes`)
    ? `<${tag} ${layoutAttrs}>${layout}</${tag}>`
    : `<${tag} ${layoutAttrs} ...attributes>${layout}</${tag}>`;
};

export const BuildGlimmerComponent = (blueprint: ComponentBlueprint) => {
  let { tag = 'div', layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
  const builder = InvocationBuilder.ANGLE;

  let invocation = AngleBracketStyle(blueprint);
  let layoutAttrs = builder.attributes(blueprint.layoutAttributes);

  return {
    name,
    invocation,
    template: layout.includes(`...attributes`)
      ? `<${tag} ${layoutAttrs}>${layout}</${tag}>`
      : `<${tag} ${layoutAttrs} ...attributes>${layout}</${tag}>`,
  };
};

const CurlyTemplate = (
  builder: InvocationBuilder,
  {
    name,
    template,
    blockParams,
    else: elseBlock,
  }: { name: string; template: string; blockParams: string[]; else?: string | undefined }
) => {
  let block: string[] = [];
  block.push(builder.blockParams(blockParams));
  block.push('}}');
  block.push(template);
  block.push(builder.else(elseBlock));
  block.push(`{{/${name}}}`);
  return block.join('');
};

export const BuildCurlyInvoke = ((blueprint: ComponentBlueprint) => {
  const builder = InvocationBuilder.CURLIES;

  let {
    args = {},
    template,
    attributes,
    else: elseBlock,
    name = CURLY_TEST_COMPONENT,
    blockParams = [],
  } = blueprint;

  if (attributes) {
    throw new Error('Cannot pass attributes to curly components');
  }

  let invocation: string[] | string = [];

  if (template) {
    invocation.push(`{{#${name}`);
  } else {
    invocation.push(`{{${name}`);
  }

  let componentArgs = builder.args(args);

  if (componentArgs !== '') {
    invocation.push(' ');
    invocation.push(componentArgs);
  }

  if (template) {
    invocation.push(CurlyTemplate(builder, { name, template, blockParams, else: elseBlock }));
  } else {
    invocation.push('}}');
  }

  return { name, invocation: invocation.join('') };
}) satisfies BuildInvocation;

export const BuildCurlyTemplate = (blueprint: ComponentBlueprint) => {
  return blueprint.layout;
};

export const BuildDynamicInvoke = ((blueprint: ComponentBlueprint) => {
  const builder = InvocationBuilder.CURLIES;

  let {
    args = {},
    name = GLIMMER_TEST_COMPONENT,
    template,
    attributes,
    else: elseBlock,
    blockParams = [],
  } = blueprint;

  if (attributes) {
    throw new Error('Cannot pass attributes to curly components');
  }

  let invocation: string | string[] = [];
  if (template) {
    invocation.push('{{#component this.componentName');
  } else {
    invocation.push('{{component this.componentName');
  }

  let componentArgs = builder.args(args);

  if (componentArgs !== '') {
    invocation.push(' ');
    invocation.push(componentArgs);
  }

  if (template) {
    invocation.push(
      CurlyTemplate(builder, { name: 'component', template, blockParams, else: elseBlock })
    );
  } else {
    invocation.push('}}');
  }

  return { name, invocation: invocation.join('') };
}) satisfies BuildInvocation;

export const BuildDynamicTemplate = (blueprint: ComponentBlueprint) => {
  return blueprint.layout;
};

export const BuildDynamicComponent = ((blueprint: ComponentBlueprint) => {
  const builder = InvocationBuilder.CURLIES;

  let {
    args = {},
    layout,
    template,
    attributes,
    else: elseBlock,
    name = GLIMMER_TEST_COMPONENT,
    blockParams = [],
  } = blueprint;

  if (attributes) {
    throw new Error('Cannot pass attributes to curly components');
  }

  let invocation: string | string[] = [];
  if (template) {
    invocation.push('{{#component this.componentName');
  } else {
    invocation.push('{{component this.componentName');
  }

  let componentArgs = builder.args(args);

  if (componentArgs !== '') {
    invocation.push(' ');
    invocation.push(componentArgs);
  }

  if (template) {
    invocation.push(
      CurlyTemplate(builder, { name: 'component', template, blockParams, else: elseBlock })
    );
  } else {
    invocation.push('}}');
  }

  return {
    name,
    template: layout,
    invocation: invocation.join(''),
  };
}) satisfies ComponentStyle;
