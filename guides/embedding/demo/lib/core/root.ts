import type { RenderResult } from '@glimmer/interfaces';
import { associateDestroyableChild } from '@glimmer/destroyable';

export class RenderRoot {
  #result: RenderResult;

  constructor(result: RenderResult) {
    this.#result = result;
    associateDestroyableChild(this, result);
  }

  revalidate() {
    const { env } = this.#result;
    env.begin();
    this.#result.rerender();
    env.commit();
  }
}
