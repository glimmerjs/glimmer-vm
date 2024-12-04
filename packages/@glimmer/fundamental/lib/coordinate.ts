import type { Optional } from '@glimmer/interfaces';

import { beginTrackFrame, beginUntrackFrame, endTrackFrame, endUntrackFrame } from './tracking';

const COORDINATION = Symbol.for('@glimmer/fundamental');

let current = Reflect.get(globalThis, COORDINATION) as Optional<Coordination>;

interface Coordination {
  beginTrackFrame: () => void;
  endTrackFrame: () => void;
  beginUntrackFrame: () => void;
  endUntrackFrame: () => void;
}

if (!current) {
  current = {
    beginTrackFrame,
    endTrackFrame,
    beginUntrackFrame,
    endUntrackFrame,
  };

  Reflect.set(globalThis, COORDINATION, current);
}

export const coordination = current;
