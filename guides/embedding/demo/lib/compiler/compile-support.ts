interface ModuleTag {
  [Symbol.toStringTag]: 'Module';
}
type ModuleObject = Record<string, unknown> & ModuleTag;

export async function asModule<T = ModuleObject>(
  source: string,
  { at, name = 'template.js' }: { at: { url: URL | string }; name?: string }
): Promise<T & ModuleTag> {
  if (typeof window === 'undefined') {
    const { default: fromMem } = await import('@peggyjs/from-mem');
    return fromMem(source, {
      filename: new URL(name, at.url).pathname,
      format: 'es',
    }) as Promise<T & ModuleTag>;
  }

  const blob = new Blob([source], { type: 'application/javascript' });

  return import(URL.createObjectURL(blob));

  // const init = createInitminalRun({
  //   whitelists: [...defaultSafeObjects, 'Proxy', 'WeakMap', 'WeakSet'],
  // });
  // const result = await init.run(
  //   source,
  //   {
  //     '@glimmer/validator': 'http://localhost:5173/node_modules/@glimmer/validator/index.ts',
  //     '@glimmer/manager': 'http://localhost:5173/node_modules/@glimmer/manager/index.ts',
  //     '@glimmer/opcode-compiler':
  //       'http://localhost:5173/node_modules/@glimmer/opcode-compiler/index.ts',
  //     '@glimmer/runtime': 'http://localhost:5173/node_modules/@glimmer/runtime/index.ts',
  //   },
  //   null,
  //   'default'
  // );

  // if (result.success) {
  //   console.log(result);
  //   return result.value as T & ModuleTag;
  // } else {
  //   throw result.error;
  // }
}

function esm(templateStrings: TemplateStringsArray, ...substitutions: string[]) {
  let js = templateStrings.raw[0] as string;
  for (let i = 0; i < substitutions.length; i++) {
    js += substitutions[i] + templateStrings.raw[i + 1];
  }
  return 'data:text/javascript;base64,' + btoa(js);
}
