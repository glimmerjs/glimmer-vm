export const EMPTY_ARRAY: any[] = Object.freeze([]) as any;

export function join<T, U>(input: T[], separator: () => U): Array<T | U> {
  let out: Array<T | U> = [];

  let last = input.length - 1;

  for (let i = 0; i < input.length; i++) {
    out.push(input[i]);

    if (i !== last) {
      out.push(separator());
    }
  }

  return out;
}

export function interleave<T>(
  input: T[],
  { value, between }: { value(value: T): void; between(): void }
): void {
  let last = input.length - 1;

  for (let i = 0; i < input.length; i++) {
    value(input[i]);

    if (i !== last) {
      between();
    }
  }
}
