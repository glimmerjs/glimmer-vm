import type { StatementSexpOpcode } from '@glimmer/interfaces';

import type { PushStatementOp } from './compilers';

import { Compilers } from './compilers';
import { defineContent } from './content';
import { defineDOM } from './dom';

export type DefineStatement = Compilers<PushStatementOp, StatementSexpOpcode>;

export const STATEMENTS = new Compilers<PushStatementOp, StatementSexpOpcode>();

defineDOM(STATEMENTS);
defineContent(STATEMENTS);
