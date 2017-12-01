import instantiate from "./wasm";

const imports = {};
const mod = instantiate(imports);

export const { fibonacci } = mod;
