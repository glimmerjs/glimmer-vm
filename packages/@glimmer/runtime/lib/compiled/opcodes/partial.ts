import { VersionedPathReference } from '@glimmer/reference';
import { TemplateMeta } from '@glimmer/wire-format';
import { Op } from '@glimmer/vm';
import { APPEND_OPCODES } from '../../opcodes';
import { PartialDefinition } from '../../partial';

APPEND_OPCODES.add(Op.GetPartialTemplate, vm => {
  let stack = vm.stack;
  let definition = stack.pop<VersionedPathReference<PartialDefinition<TemplateMeta>>>();
  stack.push(definition.value().template.asPartial());
});
