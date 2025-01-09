/** @import {Config} from './types.js' */

/**
 * @returns {Config['env']}
 */
export function getTestEnv() {
  // same order as in benchmark/benchmarks/krausest/lib/index.ts
  const appMarkers = [
    'render',
    'render1000Items1',
    'clearItems1',
    'render1000Items2',
    'clearItems2',
    'render5000Items1',
    'clearManyItems1',
    'render5000Items2',
    'clearManyItems2',
    'render1000Items3',
    'append1000Items1',
    'append1000Items2',
    'updateEvery10thItem1',
    'updateEvery10thItem2',
    'selectFirstRow1',
    'selectSecondRow1',
    'removeFirstRow1',
    'removeSecondRow1',
    'swapRows1',
    'swapRows2',
    'clearItems4',
  ].reduce((acc, marker) => {
    return acc + ',' + marker + 'Start,' + marker + 'End';
  }, '');

  /**
   * @type {string[]}
   */
  const markers = (process.env['MARKERS'] || appMarkers).split(',').filter((el) => el.length);

  const fidelity = process.env['FIDELITY'] || '20';
  const throttleRate = process.env['THROTTLE'] || '2';

  return /** @type {const} */ ({
    markers,
    fidelity,
    throttleRate,
  });
}
