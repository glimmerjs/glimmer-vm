import instantiate from "./rust";

const imports = {};
const mod = instantiate(imports);
export const {
  stack_new,
  stack_free,
  stack_copy,
  stack_write_raw,
  stack_write,
  stack_read_raw,
  stack_read,
  stack_reset,
} = mod;
