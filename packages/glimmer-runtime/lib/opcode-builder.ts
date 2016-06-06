import {
  ComponentDefinition
} from './component/interfaces';

import {
  FunctionExpression
} from './compiled/expressions/function';

import {
  EvaluatedArgs
} from './compiled/expressions/args';

import {
  Args,
  Templates,
} from './syntax/core';

import {
  Opaque,
  InternedString
} from 'glimmer-util';

export interface StaticComponentOptions {
  definition: ComponentDefinition<Opaque>;
  args: Args;
  shadow: InternedString[];
  templates: Templates;
}

export interface DynamicComponentOptions {
  definitionArgs: Args;
  definition: FunctionExpression<{ definition: ComponentDefinition<Opaque>, args: EvaluatedArgs}>;
  args: Args;
  shadow: InternedString[];
  templates: Templates;
}

interface OpcodeBuilder {
  component: {
    static(options: StaticComponentOptions);
    dynamic(options: DynamicComponentOptions);
  };
}

export default OpcodeBuilder;
