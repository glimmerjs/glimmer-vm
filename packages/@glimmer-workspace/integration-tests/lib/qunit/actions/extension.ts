import { installExtensions } from './assert-extension';
import { installUiExtensions } from './ui-extension';

export function Actions(qunit: QUnit) {
  installExtensions(qunit);
  installUiExtensions(qunit);
}
