/**
 * A free variable is resolved according to a resolution rule:
 *
 * 1. Strict resolution
 * 2. Namespaced resolution
 * 3. Fallback resolution
 */

import type { GetContextualFreeOpcode } from '@glimmer/interfaces';
import {
  WIRE_GET_FREE_AS_COMPONENT_HEAD,
  WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD,
  WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_HELPER_HEAD,
  WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_MODIFIER_HEAD,
  WIRE_GET_STRICT_KEYWORD,
} from '@glimmer/wire-format';

/**
 * Strict resolution is used:
 *
 * 1. in a strict mode template
 * 2. in an unambiguous invocation with dot paths
 */
export const STRICT_RESOLUTION = {
  resolution: (): GetContextualFreeOpcode => WIRE_GET_STRICT_KEYWORD,
  serialize: (): SerializedResolution => 'Strict',
  isAngleBracket: false as const,
};

export type StrictResolution = typeof STRICT_RESOLUTION;

export const HTML_RESOLUTION = {
  ...STRICT_RESOLUTION,
  isAngleBracket: true as const,
};

export type HtmlResolution = typeof HTML_RESOLUTION;

export function isStrictResolution(value: unknown): value is StrictResolution {
  return value === STRICT_RESOLUTION;
}

/**
 * A `LooseModeResolution` includes:
 *
 * - 0 or more namespaces to resolve the variable in
 * - optional fallback behavior
 *
 * In practice, there are a limited number of possible combinations of these degrees of freedom,
 * and they are captured by the `Ambiguity` union below.
 */
export class LooseModeResolution {
  /**
   * Namespaced resolution is used in an unambiguous syntax position:
   *
   * 1. `(sexp)` (namespace: `Helper`)
   * 2. `{{#block}}` (namespace: `Component`)
   * 3. `<a {{modifier}}>` (namespace: `Modifier`)
   * 4. `<Component />` (namespace: `Component`)
   *
   * @see {NamespacedAmbiguity}
   */
  static namespaced(namespace: FreeVariableNamespace, isAngleBracket = false): LooseModeResolution {
    return new LooseModeResolution(
      {
        namespaces: [namespace],
        fallback: false,
      },
      isAngleBracket
    );
  }

  /**
   * Fallback resolution is used when no namespaced resolutions are possible, but fallback
   * resolution is still allowed.
   *
   * ```hbs
   * {{x.y}}
   * ```
   *
   * @see {FallbackAmbiguity}
   */
  static fallback(): LooseModeResolution {
    return new LooseModeResolution({ namespaces: [], fallback: true });
  }

  /**
   * Append resolution is used when the variable should be resolved in both the `component` and
   * `helper` namespaces. Fallback resolution is optional.
   *
   * ```hbs
   * {{x}}
   * ```
   *
   * ^ `x` should be resolved in the `component` and `helper` namespaces with fallback resolution.
   *
   * ```hbs
   * {{x y}}
   * ```
   *
   * ^ `x` should be resolved in the `component` and `helper` namespaces without fallback
   * resolution.
   *
   * @see {ComponentOrHelperAmbiguity}
   */
  static append({ invoke }: { invoke: boolean }): LooseModeResolution {
    return new LooseModeResolution({
      namespaces: [FreeVariableNamespace.Component, FreeVariableNamespace.Helper],
      fallback: !invoke,
    });
  }

  /**
   * Trusting append resolution is used when the variable should be resolved in both the `component` and
   * `helper` namespaces. Fallback resolution is optional.
   *
   * ```hbs
   * {{{x}}}
   * ```
   *
   * ^ `x` should be resolved in the `component` and `helper` namespaces with fallback resolution.
   *
   * ```hbs
   * {{{x y}}}
   * ```
   *
   * ^ `x` should be resolved in the `component` and `helper` namespaces without fallback
   * resolution.
   *
   * @see {HelperAmbiguity}
   */
  static trustingAppend({ invoke }: { invoke: boolean }): LooseModeResolution {
    return new LooseModeResolution({
      namespaces: [FreeVariableNamespace.Helper],
      fallback: !invoke,
    });
  }

  /**
   * Attribute resolution is used when the variable should be resolved as a `helper` with fallback
   * resolution.
   *
   * ```hbs
   * <a href={{x}} />
   * <a href="{{x}}.html" />
   * ```
   *
   * ^ resolved in the `helper` namespace with fallback
   *
   * @see {HelperAmbiguity}
   */
  static attr(): LooseModeResolution {
    return new LooseModeResolution({ namespaces: [FreeVariableNamespace.Helper], fallback: true });
  }

  constructor(readonly ambiguity: Ambiguity, readonly isAngleBracket = false) {}

  resolution(): GetContextualFreeOpcode {
    if (this.ambiguity.namespaces.length === 0) {
      return WIRE_GET_STRICT_KEYWORD;
    } else if (this.ambiguity.namespaces.length === 1) {
      if (this.ambiguity.fallback) {
        // simple namespaced resolution with fallback must be attr={{x}}
        return WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK;
      } else {
        // simple namespaced resolution without fallback
        switch (this.ambiguity.namespaces[0]) {
          case FreeVariableNamespace.Helper:
            return WIRE_GET_FREE_AS_HELPER_HEAD;
          case FreeVariableNamespace.Modifier:
            return WIRE_GET_FREE_AS_MODIFIER_HEAD;
          case FreeVariableNamespace.Component:
            return WIRE_GET_FREE_AS_COMPONENT_HEAD;
        }
      }
    } else if (this.ambiguity.fallback) {
      // component or helper + fallback ({{something}})
      return WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK;
    } else {
      // component or helper without fallback ({{something something}})
      return WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD;
    }
  }

  serialize(): SerializedResolution {
    if (this.ambiguity.namespaces.length === 0) {
      return 'Loose';
    } else if (this.ambiguity.namespaces.length === 1) {
      if (this.ambiguity.fallback) {
        // simple namespaced resolution with fallback must be attr={{x}}
        return ['ambiguous', SerializedAmbiguity.Attribute];
      } else {
        return ['ns', this.ambiguity.namespaces[0]];
      }
    } else if (this.ambiguity.fallback) {
      // component or helper + fallback ({{something}})
      return ['ambiguous', SerializedAmbiguity.Append];
    } else {
      // component or helper without fallback ({{something something}})
      return ['ambiguous', SerializedAmbiguity.Invoke];
    }
  }
}

export const ARGUMENT_RESOLUTION = LooseModeResolution.fallback();

export enum FreeVariableNamespace {
  Helper = 'Helper',
  Modifier = 'Modifier',
  Component = 'Component',
}

export const HELPER_NAMESPACE = FreeVariableNamespace.Helper;
export const MODIFIER_NAMESPACE = FreeVariableNamespace.Modifier;
export const COMPONENT_NAMESPACE = FreeVariableNamespace.Component;

/**
 * A `ComponentOrHelperAmbiguity` might be a component or a helper, with an optional fallback
 *
 * ```hbs
 * {{x}}
 * ```
 *
 * ^ `x` is resolved in the `component` and `helper` namespaces, with fallback
 *
 * ```hbs
 * {{x y}}
 * ```
 *
 * ^ `x` is resolved in the `component` and `helper` namespaces, without fallback
 */
type ComponentOrHelperAmbiguity = {
  namespaces: [FreeVariableNamespace.Component, FreeVariableNamespace.Helper];
  fallback: boolean;
};

/**
 * A `HelperAmbiguity` must be a helper, but it has fallback. If it didn't have fallback, it would
 * be a `NamespacedAmbiguity`.
 *
 * ```hbs
 * <a href={{x}} />
 * <a href="{{x}}.html" />
 * ```
 *
 * ^ `x` is resolved in the `helper` namespace with fallback
 */
type HelperAmbiguity = { namespaces: [FreeVariableNamespace.Helper]; fallback: boolean };

/**
 * A `NamespacedAmbiguity` must be resolved in a particular namespace, without fallback.
 *
 * ```hbs
 * <X />
 * ```
 *
 * ^ `X` is resolved in the `component` namespace without fallback
 *
 * ```hbs
 * (x)
 * ```
 *
 * ^ `x` is resolved in the `helper` namespace without fallback
 *
 * ```hbs
 * <a {{x}} />
 * ```
 *
 * ^ `x` is resolved in the `modifier` namespace without fallback
 */
type NamespacedAmbiguity = {
  namespaces: [
    FreeVariableNamespace.Component | FreeVariableNamespace.Helper | FreeVariableNamespace.Modifier
  ];
  fallback: false;
};

type FallbackAmbiguity = {
  namespaces: [];
  fallback: true;
};

type Ambiguity =
  | ComponentOrHelperAmbiguity
  | HelperAmbiguity
  | NamespacedAmbiguity
  | FallbackAmbiguity;

export type FreeVarResolution = StrictResolution | HtmlResolution | LooseModeResolution;

// Serialization

const enum SerializedAmbiguity {
  // {{x}}
  Append = 'Append',
  // href={{x}}
  Attribute = 'Attribute',
  // {{x y}} (not attr)
  Invoke = 'Invoke',
}

export type SerializedResolution =
  | 'Strict'
  | 'Loose'
  | ['ns', FreeVariableNamespace]
  | ['ambiguous', SerializedAmbiguity];

export function loadResolution(resolution: SerializedResolution): FreeVarResolution {
  if (typeof resolution === 'string') {
    switch (resolution) {
      case 'Loose':
        return LooseModeResolution.fallback();
      case 'Strict':
        return STRICT_RESOLUTION;
    }
  }

  switch (resolution[0]) {
    case 'ambiguous':
      switch (resolution[1]) {
        case SerializedAmbiguity.Append:
          return LooseModeResolution.append({ invoke: false });
        case SerializedAmbiguity.Attribute:
          return LooseModeResolution.attr();
        case SerializedAmbiguity.Invoke:
          return LooseModeResolution.append({ invoke: true });
      }

    case 'ns':
      return LooseModeResolution.namespaced(resolution[1]);
  }
}
