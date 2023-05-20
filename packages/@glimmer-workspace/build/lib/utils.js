/**
 * @template T
 * @param {Record<string, T>} record
 * @returns {T[]}
 */
export function values(record) {
  return Object.values(record);
}

/**
 * @template {Record<string, unknown>} D
 * @param {D} record
 * @returns {import("@glimmer/util").ObjectEntry<D>[]}
 */
export function entries(record) {
  return /** @type {any} */ (Object.entries(record));
}
