import { PathReference, Reference } from '@glimmer/reference';
import { Dict, Opaque, Set } from '@glimmer/util';

export interface NotifiableReference<T> extends Reference<T> {
  // notify();
}

export interface ChainableReference<T> extends Reference<T> {
  // chain(child: Reference): Destroyable;
}

export interface PathReferenceFactory<T> {
  new (object: any, property: string): PathReference<T>;
}

export interface RootReferenceFactory<T> {
  new (object: T): RootReference<T>;
}

export interface RootReference<T> extends PathReference<T> {
  update(value: T): void;
  referenceFromParts(parts: string[]): PathReference<Opaque>;
  chainFor(prop: string): Option<PathReference<T>>;
}

import { Option } from '@glimmer/interfaces';
import { InnerReferenceFactory } from './references/descriptors';

export interface MetaOptions {
  RootReferenceFactory?: RootReferenceFactory<any>;
  DefaultPathReferenceFactory?: InnerReferenceFactory<any>;
}

export interface Meta {
  root(): RootReference<any>;
  referencesFor(property: string): Option<Set<PathReference<any>>>;
  referenceTypeFor(property: string): InnerReferenceFactory<any>;
  getReferenceTypes(): Dict<InnerReferenceFactory<any>>;
  addReference(property: string, reference: PathReference<any>): void;
  removeReference(property: string, reference: PathReference<any>): void;
  getSlots(): Dict<any>;
}

export interface MetaLookup {
  for(obj: any): Meta;
}
