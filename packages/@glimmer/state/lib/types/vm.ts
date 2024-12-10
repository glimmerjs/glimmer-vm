export interface Arguments {
  positional: readonly unknown[];
  named: Record<string, unknown>;
}
