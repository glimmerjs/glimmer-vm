import { Option } from '@glimmer/interfaces';
import { PathReference as IPathReference, Tag, VOLATILE_TAG } from '@glimmer/reference';
import { Opaque, dict } from '@glimmer/util';
import { RootReference as IRootReference } from '../types';
import { PathReference } from './path';

export default class RootReference<T> implements IRootReference<T>, IPathReference<T> {
  private object: T;
  private chains = dict<PathReference<any>>();
  tag: Tag = VOLATILE_TAG;

  constructor(object: T) {
    this.object = object;
  }

  value(): T { return this.object; }

  update(object: T) {
    this.object = object;
    // this.notify();
  }

  get<U>(prop: string): IPathReference<U> {
    let chains = this.chains;
    if (prop as string in chains) return chains[prop];
    return (chains[prop] = new PathReference(this, prop));
  }

  chainFor<U>(prop: string): Option<IPathReference<U>> {
    let chains = this.chains;
    if (prop as string in chains) return chains[prop];
    return null;
  }

  path(string: string): IPathReference<Opaque> {
    return string.split('.').reduce((ref, part) => ref.get(part), this as IPathReference<Opaque>);
  }

  referenceFromParts(parts: string[]): IPathReference<Opaque> {
    return parts.reduce((ref, part) => ref.get(part) as IPathReference<Opaque>, this as IPathReference<Opaque>);
  }

  label() {
    return '[reference Root]';
  }
}
