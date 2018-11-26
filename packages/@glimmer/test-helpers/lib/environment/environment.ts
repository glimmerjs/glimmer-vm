import {
  Environment,
  DOMTreeConstruction,
  IDOMChanges,
  PrimitiveReference,
  ConditionalReference,
} from '@glimmer/runtime';
import { dict } from '@glimmer/util';
import { Dict, RuntimeResolver, Opaque, VMHandle, UserValue } from '@glimmer/interfaces';
import { Program } from '@glimmer/program';
import { Reference, isConst, OpaqueIterable } from '@glimmer/reference';

import { KeyFor, Iterable } from './iterable';

export interface TestEnvironmentOptions {
  appendOperations: DOMTreeConstruction;
  updateOperations: IDOMChanges;
}

export default abstract class TestEnvironment<Locator> extends Environment {
  public compiledLayouts: Dict<VMHandle> = dict();

  protected abstract program: Program<Locator>;
  protected abstract resolver: RuntimeResolver<Locator>;

  protocolForURL(url: string): string {
    if (typeof window === 'undefined') {
      let match = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\S\s]*)/i.exec(url);
      return match && match[1] ? match[1].toLowerCase() : '';
    }

    let anchor = window.document.createElement('a');
    anchor.href = url;
    return anchor.protocol;
  }

  toConditionalReference(reference: Reference<any>): Reference<boolean> {
    if (isConst(reference)) {
      return PrimitiveReference.create(emberToBool(reference.value()));
    }

    return new EmberishConditionalReference(reference);
  }

  iterableFor(ref: Reference<Opaque>, keyPath: string): OpaqueIterable {
    let keyFor: KeyFor<unknown>;

    if (!keyPath) {
      throw new Error('Must specify a key for #each');
    }

    switch (keyPath) {
      case '@index':
        keyFor = (_, index: unknown) => String(index);
        break;
      case '@primitive':
        keyFor = (item: UserValue) => String(item);
        break;
      default:
        // TODO: Is this correct?
        keyFor = (item: UserValue) => (item ? String(item[keyPath]) : 'null');
        break;
    }

    return new Iterable(ref, keyFor);
  }
}

function emberToBool(value: any): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  } else {
    return !!value;
  }
}

class EmberishConditionalReference extends ConditionalReference {
  protected toBool(value: any): boolean {
    return emberToBool(value);
  }
}
