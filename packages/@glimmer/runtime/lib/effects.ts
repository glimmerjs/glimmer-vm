import { EffectPhase } from '@glimmer/interfaces';
import { assert } from '@glimmer/util';
import { Cache, getValue } from '@glimmer/validator';
import { DEBUG } from '@glimmer/env';
import { registerDestructor } from '@glimmer/destroyable';

// Use this to get all the effect phases into a tuple in a typesafe way
// values are unimportant, but key order is important is it's the order that
// the phases should logically run in
let phases: { [key in EffectPhase]: unknown } = {
  [EffectPhase.Layout]: 0,
};

const EFFECT_PHASES: EffectPhase[] = Object.keys(phases) as EffectPhase[];

export class EffectsManager {
  private inTransaction = false;

  constructor(private scheduleEffects: (phase: EffectPhase, callback: () => void) => void) {}

  private effects: { [key in EffectPhase]: Cache[] } = {
    [EffectPhase.Layout]: [],
  };

  /**
   * Tracker for new effects added within a given render transaction. This is
   * used to coordinate adding effects to the queue. In a given render pass, all
   * effects added should be added in the order they were received, but they
   * should be _prepended_ to any pre-existing effects. For instance, let's say
   * that the queue started off in this state after our first render pass:
   *
   *   A, B, C
   *
   * On the next render pass, we add D and E, which are siblings, and children
   * of A. The timing semantics of effects is that siblings should be
   * initialized in the order they were defined in, and should run before
   * parents. So, assuming D comes before E, we want to do:
   *
   *   D, E, A, B, C
   *
   * This way, new children will always run in the correct order, and before
   * their parents. By keeping track of the new effects during a given
   * transaction in a separate array, we can then efficiently add them to the
   * beginning of the overall effect queue at the end, and preserve the proper
   * order.
   */
  private newEffects: { [key in EffectPhase]: Cache[] } = {
    [EffectPhase.Layout]: [],
  };

  begin() {
    if (DEBUG) {
      this.inTransaction = true;
    }
  }

  registerEffect(phase: EffectPhase, effect: Cache) {
    assert(this.inTransaction, 'You cannot register effects unless you are in a transaction');

    this.newEffects[phase].push(effect);

    registerDestructor(effect, () => {
      let queue = this.effects[phase];
      let index = queue.indexOf(effect);

      assert(index !== -1, 'attempted to remove an effect, but it was not in the effect queue');

      queue.splice(index, 1);
    });
  }

  commit() {
    if (DEBUG) {
      this.inTransaction = false;
    }

    let { effects, newEffects, scheduleEffects } = this;

    for (let phase of EFFECT_PHASES) {
      let queue = newEffects[phase].concat(effects[phase]);
      effects[phase] = queue;
      newEffects[phase] = [];

      // weirdness here to avoid closure assertion in Ember
      scheduleEffects(phase, queue.forEach.bind(queue, getValue));
    }
  }
}
