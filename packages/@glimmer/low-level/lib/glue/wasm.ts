// Load the `url` specified and instantiate a WebAssembly module with the
// `imports` provided as well.
export async function load(url: string, imports?: any): Promise<WebAssembly.Instance> {
  let response = await fetch(url);
  return await instantiate(await response.arrayBuffer(), imports);
}

// Instantiates a new WebAssembly module given the module as `bytes`.
export async function instantiate(bytes: ArrayBuffer | Uint8Array, imports?: any): Promise<WebAssembly.Instance> {
  let results = await WebAssembly.instantiate(bytes, imports);
  return results.instance;
}
