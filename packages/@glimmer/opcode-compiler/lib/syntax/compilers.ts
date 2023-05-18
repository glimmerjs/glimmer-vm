import type { ExpressionSexpOpcode, StatementSexpOpcode } from '@glimmer/interfaces';
import { Compilers, type PushExpressionOp, type PushStatementOp } from './compiler-impl';

const EXPRESSIONS = new Compilers<PushExpressionOp, ExpressionSexpOpcode>();
export const defineExpr = EXPRESSIONS.add;
export const compileExpr = EXPRESSIONS.compile;

const STATEMENTS = new Compilers<PushStatementOp, StatementSexpOpcode>();
export const defineStatement = STATEMENTS.add;
export const compileStatement = STATEMENTS.compile;
