import { Op } from '@glimmer/vm';
import { COMPONENT_MAPPINGS } from './component';
import { CONTENT_MAPPINGS } from './content';
import { DEBUG_MAPPINGS } from './debugger';
import { DOM_MAPPINGS } from './dom';
import { EXPRESSION_MAPPINGS } from './expressions';
import { LIST_MAPPINGS } from './lists';
import { PARTIAL_MAPPINGS } from './partial';
import { VM_MAPPINGS } from './vm';
import { assign } from "@glimmer/util";

export const operations = new Array(Op.Size);

let operationsMap = assign({},
  COMPONENT_MAPPINGS,
  CONTENT_MAPPINGS,
  DEBUG_MAPPINGS,
  DOM_MAPPINGS,
  EXPRESSION_MAPPINGS,
  LIST_MAPPINGS,
  PARTIAL_MAPPINGS,
  VM_MAPPINGS
);

for (let key in operationsMap) {
  operations[key] = operationsMap[key];
}
