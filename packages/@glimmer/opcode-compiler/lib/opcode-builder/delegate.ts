import { ComponentCapabilities, Optional, CompileTimeComponent } from '@glimmer/interfaces';

export const DEFAULT_CAPABILITIES: ComponentCapabilities = {
  dynamicLayout: true,
  dynamicTag: true,
  prepareArgs: true,
  createArgs: true,
  attributeHook: false,
  elementHook: false,
  dynamicScope: true,
  createCaller: false,
  updateHook: true,
  createInstance: true,
  wrapped: false,
  willDestroy: false,
};

export const MINIMAL_CAPABILITIES: ComponentCapabilities = {
  dynamicLayout: false,
  dynamicTag: false,
  prepareArgs: false,
  createArgs: false,
  attributeHook: false,
  elementHook: false,
  dynamicScope: false,
  createCaller: false,
  updateHook: false,
  createInstance: false,
  wrapped: false,
  willDestroy: false,
};

export interface ResolverDelegate<R = unknown> {
  lookupHelper?(name: string, referrer: R): Optional<number> | void;
  lookupModifier?(name: string, referrer: R): Optional<number> | void;
  lookupComponent?(name: string, referrer: R): Optional<CompileTimeComponent> | void;
  lookupPartial?(name: string, referrer: R): Optional<number> | void;

  // For debugging
  resolve?(handle: number): R;
}
