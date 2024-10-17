import { createBenchmark } from '@/utils/benchmark';

import { enforcePaintEvent, ButtonSelectors, emitDomClickEvent, waitForIdle } from '@/utils/compat';

// @ts-check
// https://codepen.io/lifeart/pen/abMzEZm?editors=0110
// https://github.com/glimmerjs/glimmer-vm/issues/1540

export default async function render() {
  const benchmark = createBenchmark();

  // starting app

  await waitForIdle();

  const app = await benchmark.render();

  await waitForIdle();

  // return;

  await app('render1000Items1', () => {
    emitDomClickEvent(ButtonSelectors.Create1000);
  });

  await waitForIdle();

  await app('clearItems1', () => {
    emitDomClickEvent(ButtonSelectors.Clear);
  });

  await waitForIdle();

  await app('render1000Items2', () => {
    emitDomClickEvent(ButtonSelectors.Create1000);
  });

  await waitForIdle();

  await app('clearItems2', () => {
    emitDomClickEvent(ButtonSelectors.Clear);
  });

  await waitForIdle();

  await app('render5000Items1', () => {
    emitDomClickEvent(ButtonSelectors.Create5000);
  });

  await waitForIdle();

  await app('clearManyItems1', () => {
    emitDomClickEvent(ButtonSelectors.Clear);
  });

  await waitForIdle();

  await app('render5000Items2', () => {
    emitDomClickEvent(ButtonSelectors.Create5000);
  });

  await waitForIdle();

  await app('clearManyItems2', () => {
    emitDomClickEvent(ButtonSelectors.Clear);
  });

  await waitForIdle();

  await app('render1000Items3', () => {
    emitDomClickEvent(ButtonSelectors.Create1000);
  });

  await waitForIdle();

  await app('append1000Items1', () => {
    emitDomClickEvent(ButtonSelectors.Append1000);
  });

  await waitForIdle();

  await app('append1000Items2', () => {
    emitDomClickEvent(ButtonSelectors.Append1000);
  });

  await waitForIdle();

  await app('updateEvery10thItem1', () => {
    emitDomClickEvent(ButtonSelectors.UpdateEvery10th);
  });

  await waitForIdle();

  await app('updateEvery10thItem2', () => {
    emitDomClickEvent(ButtonSelectors.UpdateEvery10th);
  });

  await waitForIdle();

  await app('selectFirstRow1', () => {
    emitDomClickEvent(ButtonSelectors.SelectFirstRow);
  });

  await waitForIdle();

  await app('selectSecondRow1', () => {
    emitDomClickEvent(ButtonSelectors.SelectSecondRow);
  });

  await waitForIdle();

  await app('removeFirstRow1', () => {
    emitDomClickEvent(ButtonSelectors.RemoveFirstRow);
  });

  await waitForIdle();

  await app('removeSecondRow1', () => {
    emitDomClickEvent(ButtonSelectors.RemoveSecondRow);
  });

  await waitForIdle();

  await app('swapRows1', () => {
    emitDomClickEvent(ButtonSelectors.SwapRows);
  });

  await waitForIdle();

  await app('swapRows2', () => {
    emitDomClickEvent(ButtonSelectors.SwapRows);
  });

  await waitForIdle();

  await app('clearItems4', () => {
    emitDomClickEvent(ButtonSelectors.Clear);
  });

  // finishing bench
  enforcePaintEvent();
}
