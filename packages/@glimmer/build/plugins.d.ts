// declare module "eslint-plugin-*" {
//   declare const DEFAULT: ESLint.Plugin;
//   export default DEFAULT;
// }

import type { FlatConfigObject } from "./eslint-flat.js.js.js";

declare module "eslint-plugin-*" {
  const DEFAULT: FlatConfigObject;
  export default DEFAULT;
}
