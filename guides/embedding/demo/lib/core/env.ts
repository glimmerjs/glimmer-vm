import type { Destroyable, Destructor } from '@glimmer/interfaces';
import type { EnvironmentDelegate } from '@glimmer/runtime';

export let scheduledDestruction: {
  destroyable: Destroyable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  destructor: Destructor<any>;
}[] = [];
export let scheduledFinishDestruction: (() => void)[] = [];

/**
 * The environment delegate base class shared by both the client and SSR
 * environments. Contains shared definitions, but requires user to specify
 * `isInteractive` and a method for getting the protocols of URLs.
 *
 * @internal
 */
export class EnvDelegate implements EnvironmentDelegate {
  readonly isInteractive: boolean;

  enableDebugTooling = false;
  owner = {};

  constructor(isInteractive: boolean) {
    this.isInteractive = isInteractive;
  }

  onTransactionCommit(): void {
    for (const { destroyable, destructor } of scheduledDestruction) {
      destructor(destroyable);
    }

    scheduledFinishDestruction.forEach((fn) => fn());

    scheduledDestruction = [];
    scheduledFinishDestruction = [];
  }
}
