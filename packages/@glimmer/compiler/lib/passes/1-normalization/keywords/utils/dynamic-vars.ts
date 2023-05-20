import { type ASTv2, generateSyntaxError } from '@glimmer/syntax';

import { Err as Error_, Ok, type Result } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import type { NormalizationState } from '../../context';
import { VISIT_EXPRS } from '../../visitors/expressions';
import type { GenericKeywordNode, KeywordDelegate } from '../impl';

function assertGetDynamicVariableKeyword(node: GenericKeywordNode): Result<ASTv2.ExpressionNode> {
  let call = node.type === 'AppendContent' ? node.value : node;

  let named = call.type === 'Call' ? call.args.named : null;
  let positionals = call.type === 'Call' ? call.args.positional : null;

  if (named && !named.isEmpty()) {
    return Error_(
      generateSyntaxError(`(-get-dynamic-vars) does not take any named arguments`, node.loc)
    );
  }

  let variableName = positionals?.nth(0);

  if (!variableName) {
    return Error_(generateSyntaxError(`(-get-dynamic-vars) requires a var name to get`, node.loc));
  }

  if (positionals && positionals.size > 1) {
    return Error_(
      generateSyntaxError(`(-get-dynamic-vars) only receives one positional arg`, node.loc)
    );
  }

  return Ok(variableName);
}

function translateGetDynamicVariableKeyword(
  { node, state }: { node: GenericKeywordNode; state: NormalizationState },
  name: ASTv2.ExpressionNode
): Result<mir.GetDynamicVar> {
  return VISIT_EXPRS.visit(name, state).mapOk(
    (name) => new mir.GetDynamicVar({ name, loc: node.loc })
  );
}

export const getDynamicVarKeyword: KeywordDelegate<
  GenericKeywordNode,
  ASTv2.ExpressionNode,
  mir.GetDynamicVar
> = {
  assert: assertGetDynamicVariableKeyword,
  translate: translateGetDynamicVariableKeyword,
};
