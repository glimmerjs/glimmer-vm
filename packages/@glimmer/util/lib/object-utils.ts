export let assign = Object.assign;

export function values<T>(obj: { [s: string]: T }): T[] {
  const vals = [];
  for (const key in obj) {
    vals.push(obj[key]);
  }
  return vals;
}

export type ObjectEntry<D extends object> = { [P in keyof D]: [P, D[P]] }[keyof D];

export function entries<D extends object>(dict: D): ObjectEntry<D>[] {
  return Object.entries(dict) as ObjectEntry<D>[];
}
