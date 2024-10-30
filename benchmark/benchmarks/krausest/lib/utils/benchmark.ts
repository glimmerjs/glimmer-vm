import { Application } from '@/components/Application';
import { measureRender } from '@/utils/measure-render';
import { setResolveRender } from '@/utils/runtime';

export function createBenchmark() {
  return {
    async render() {
      await measureRender('render', 'renderStart', 'renderEnd', () => {
        new Application();
      });

      performance.measure('load', 'navigationStart', 'renderStart');

      return async (name: string, update: () => void) => {
        await measureRender(
          name,
          name + 'Start',
          name + 'End',
          () =>
            new Promise((resolve) => {
              setResolveRender(resolve);
              update();
            })
        );
      };
    },
  };
}
