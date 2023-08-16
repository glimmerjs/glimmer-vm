/**
 * See guides/07-error-recovery.md
 */
export interface VmStackAspect {
  readonly debug?: { frames: DebugStackAspectFrame[] };

  begin(): this;
  catch(): this;
  finally(): this;

  onCatch?(handler: () => void): this;
  onFinally?(handler: () => void): this;
}

export type DebugStackAspectFrame = DebugParentStackFrame | LeafStackAspect;

export interface DebugParentStackFrame {
  label: string;
  aspects: Record<string, DebugStackAspectFrame>;
}

export interface LeafStackAspect {
  label: string;
  values: unknown[];
}
