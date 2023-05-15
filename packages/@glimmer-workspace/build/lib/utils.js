/**
 * @template T
 * @param {Record<string, T>} obj
 * @returns {T[]}
 */
export function values(obj) {
  return Object.values(obj);
}

/**
 * @template {object} D
 * @param {D} obj
 * @returns {import("@glimmer/util/lib/object-utils").ObjectEntry<D>[]}
 */
export function entries(obj) {
  return Object.entries(obj);
}
