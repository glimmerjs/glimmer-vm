import { Effect } from '@glimmer/interfaces';
import { LinkedList, ListNode, DESTROY, associate, assert, Option } from '@glimmer/util';
import { memo } from '@glimmer/validator';
import { DEBUG } from '@glimmer/env';

const effectPhases = ['layout'] as const;
export type EffectPhase = typeof effectPhases[number];

interface EffectHooks {
  setup(): void;
  update(): void;
  teardown(): void;
}

export class EffectImpl implements Effect {
  constructor(private hooks: EffectHooks) {}

  private didSetup = false;

  createOrUpdate = memo(() => {
    if (this.didSetup === false) {
      this.didSetup = true;
      this.hooks.setup();
    } else {
      this.hooks.update();
    }
  });

  [DESTROY]() {
    this.hooks.teardown();
  }
}

function defaultScheduleEffects(_phase: EffectPhase, callback: () => void) {
  callback();
}

class EffectQueue {
  /**
   * The effects in this queue
   */
  effects: LinkedList<ListNode<Effect>> = new LinkedList();

  /**
   * Tracker for the current head of the queue. This is used to coordinate
   * adding effects to the queue. In a given render pass, all effects added
   * should be added in the order they were received, but they should be
   * _prepended_ to any pre-existing effects. For instance, let's say that the
   * queue started off in this state after our first render pass:
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
   * their parents. By keeping track of the current head at the beginning of a
   * transaction, we can insert new effects in the proper order during the
   * transaction.
   */
  currentHead: Option<ListNode<Effect>> = null;

  revalidate = () => this.effects.forEachNode(n => n.value.createOrUpdate());
}

export class EffectManager {
  private inTransaction = false;

  constructor(private scheduleEffects = defaultScheduleEffects) {
    let queues: Record<string, EffectQueue> = {};

    for (let phase of effectPhases) {
      queues[phase] = new EffectQueue();
    }

    this.queues = queues as { [key in EffectPhase]: EffectQueue };
  }

  private queues: { [key in EffectPhase]: EffectQueue };

  begin() {
    if (DEBUG) {
      this.inTransaction = true;
    }
  }

  registerEffect(phase: EffectPhase, effect: Effect) {
    assert(this.inTransaction, 'You cannot register effects unless you are in a transaction');

    let queue = this.queues[phase];
    let effects = queue.effects;
    let newNode = new ListNode(effect);

    effects.insertBefore(newNode, queue.currentHead);

    associate(effect, {
      [DESTROY]() {
        effects.remove(newNode);
      },
    });
  }

  commit() {
    if (DEBUG) {
      this.inTransaction = false;
    }

    let { queues, scheduleEffects } = this;

    for (let phase of effectPhases) {
      let queue = queues[phase];

      scheduleEffects(phase, queue.revalidate);

      queue.currentHead = queue.effects.head();
    }
  }
}
