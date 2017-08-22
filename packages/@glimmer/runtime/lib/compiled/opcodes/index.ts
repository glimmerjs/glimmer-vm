import { Op } from '@glimmer/vm';
import { COMPONENT_MAPPINGS } from './component';
import { CONTENT_MAPPINGS } from './content';
import { DEBUG_MAPPINGS } from './debugger';
import { DOM_MAPPINGS } from './dom';
import { EXPRESSION_MAPPINGS } from './expressions';
import { LIST_MAPPINGS } from './lists';
import { PARTIAL_MAPPINGS } from './partial';
import { VM_MAPPINGS } from './vm';
export * from './component';
export * from './content';
export * from './debugger';
export * from './dom';
export * from './lists';
export * from './expressions';
export * from './partial';
export * from './vm';

export const operations = new Array(Op.Size);

let operationsMap = {
  ...COMPONENT_MAPPINGS,
  ...CONTENT_MAPPINGS,
  ...DEBUG_MAPPINGS,
  ...DOM_MAPPINGS,
  ...EXPRESSION_MAPPINGS,
  ...LIST_MAPPINGS,
  ...PARTIAL_MAPPINGS,
  ...VM_MAPPINGS
};

Object.keys(operationsMap).map(t => parseInt(t, 10)).forEach((op: number) => {
  operations[op] = operationsMap[op];
});
