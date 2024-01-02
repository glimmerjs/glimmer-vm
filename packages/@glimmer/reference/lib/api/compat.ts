import { updateReactive } from './core';
import { INTERNAL_REFERENCE } from './internal';

/** @category compat */
export const updateRef = updateReactive;

/**
 * @category compat
 * @deprecated Use {@link INTERNAL_REFERENCE}
 */
export const REFERENCE = INTERNAL_REFERENCE;
