import { EventEmitter } from 'stream';

export function autoRegister(): Runner;

export interface Runner {}

class QUnitAdapter extends EventEmitter {
  constructor(qunit: unknown);
}

interface Default {
  autoRegister: typeof autoRegister;
  QUnitAdapter: QUnitAdapter;
}

declare const DEFAULT: Default;

export default DEFAULT;
