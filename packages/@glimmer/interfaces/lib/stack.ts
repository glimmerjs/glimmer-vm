export interface Stack {
  sp: number;
  fp: number;

  pushSmi(value: number): void;
  pushEncodedImmediate(value: number): void;

  getSmi(position: number): number;
  peekSmi(offset?: number): number;
  popSmi(): number;
}
