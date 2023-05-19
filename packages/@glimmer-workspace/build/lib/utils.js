/**
 * @template T
 * @param {Record<string, T>} record
 * @returns {T[]}
 */
export function values(record) {
  return Object.values(record);
}

/**
 * @template {object} D
 * @param {D} record
 * @returns {import("@glimmer/util").ObjectEntry<D>[]}
 */
export function entries(record) {
  return Object.entries(record);
}
