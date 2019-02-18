import { Macros } from './core';
import { TRUE_MACRO, FALSE_MACRO, NULL_MACRO, UNDEFINED_MACRO, THIS_MACRO } from '../macros';

export const MACROS_V1: Macros = {
  expr: {
    true: TRUE_MACRO,
    false: FALSE_MACRO,
    null: NULL_MACRO,
    undefined: UNDEFINED_MACRO,
  },

  head: {
    this: THIS_MACRO,
  },
};
