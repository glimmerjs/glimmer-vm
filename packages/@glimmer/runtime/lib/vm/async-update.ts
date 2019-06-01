import { ExceptionHandler } from '@glimmer/interfaces';
import { UpdatingOpSeq } from '../opcodes';
import UpdatingVM from './sync-update';

interface Deadline {
  didTimeout: boolean;
  timeRemaining(): number;
}

type IdleCallback = (deadline: Deadline) => void;
type PromiseCallbck = (result?: any) => void;

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

const useFallback = typeof requestIdleCallback !== 'function';
const tickExecutor = !useFallback
  ? function(cb: IdleCallback, opts: RequestIdleCallbackOptions) {
      return requestIdleCallback(cb, opts);
    }
  : function(cb: IdleCallback) {
      return setTimeout(cb);
    };
// base IE11 support without transpilation
function happyPromiseLike(cb: PromiseCallbck): Promise<void> {
  if (typeof Promise !== 'undefined') {
    return new Promise(cb);
  }
  const ctx: {
    tasks: PromiseCallbck[];
    then(cb: PromiseCallbck): void;
  } = {
    tasks: [],
    then(cb: PromiseCallbck) {
      this.tasks.push(cb);
    },
  };
  setTimeout(() => {
    cb(() => {
      ctx.tasks.forEach(task => task());
    });
  });
  return (ctx as unknown) as Promise<void>;
}
export default class AsyncUpdatingVM extends UpdatingVM {
  public timeout = 20;
  public tickSize = 50;
  public tickExecutor = tickExecutor;
  public useFallback = useFallback;
  public tickTime!: number;
  scheduleTick(tick: IdleCallback, options: RequestIdleCallbackOptions) {
    this.tickExecutor(tick, { timeout: options.timeout } as any);
  }
  haveTime(deadline: Deadline | undefined) {
    if (this.useFallback) {
      return Date.now() - this.tickTime < this.timeout;
    } else {
      return (deadline as Deadline).timeRemaining() > 1;
    }
  }
  execute(opcodes: UpdatingOpSeq, handler: ExceptionHandler): Promise<void> | void {
    this.setup(opcodes, handler);
    return happyPromiseLike(resolve => {
      let timeout = this.timeout;
      let tick = (deadline: Deadline) => {
        let iteratorResult = false;
        this.tickTime = Date.now();
        do {
          let decrement = this.tickSize;
          do {
            iteratorResult = this.next();
            decrement--;
          } while (iteratorResult && decrement > 0);
        } while (iteratorResult && this.haveTime(deadline));

        if (!iteratorResult) {
          return resolve();
        }

        this.scheduleTick(tick, { timeout });
      };

      this.scheduleTick(tick, { timeout });
    });
  }
}
