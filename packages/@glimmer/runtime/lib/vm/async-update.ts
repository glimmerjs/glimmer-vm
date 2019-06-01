import { ExceptionHandler } from '@glimmer/interfaces';
import { UpdatingOpSeq } from '../opcodes';
import UpdatingVM from './sync-update';

interface Deadline {
  didTimeout: boolean;
  timeRemaining(): number;
}

type IdleCallback = (deadline: Deadline) => void;

export interface AsyncRendererOptions {
  timeout?: number;
}
interface RequestIdleCallbackOptions {
  timeout?: number;
}

declare function requestIdleCallback(
  callback: IdleCallback,
  options?: RequestIdleCallbackOptions
): void;

export default class AsyncUpdatingVM extends UpdatingVM {
  public timeout = 20;
  public tickSize = 50;
  execute(opcodes: UpdatingOpSeq, handler: ExceptionHandler) {
    this.setup(opcodes, handler);
    return new Promise(resolve => {
      let timeout = this.timeout;
      let tick = (deadline: Deadline) => {
        let iteratorResult = false;
        do {
          let decrement = this.tickSize;
          do {
            iteratorResult = this.next();
            decrement--;
          } while (iteratorResult && decrement > 0);
        } while (iteratorResult && deadline.timeRemaining() > 1);

        if (!iteratorResult) {
          return resolve();
        }

        requestIdleCallback(tick, { timeout });
      };

      requestIdleCallback(tick, { timeout });
    });
  }
}
