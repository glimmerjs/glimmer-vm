import type { ExpressionSexpOpcode } from '@glimmer/interfaces';
import { VM_PUSH_FRAME_OP } from '@glimmer/constants';

import { Compilers } from './compilers';

export const EXPRESSIONS = new Compilers<ExpressionSexpOpcode>();
