function defaultTo(value, defaultVal) {
  return value === undefined ? defaultVal : value;
}

module.exports = function generateVmPlugins(options = {}) {
  let isDebug = defaultTo(options.isDebug, true);
  let __loadPlugins = defaultTo(options.__loadPlugins, false);

  return [
    [
      __loadPlugins
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('babel-plugin-debug-macros')
        : require.resolve('babel-plugin-debug-macros'),
      {
        debugTools: {
          source: '@glimmer/global-context',
          isDebug,
        },
        externalizeHelpers: {
          module: true,
        },
        flags: [{ source: '@glimmer/env', flags: { DEBUG: isDebug } }],
      },
      'glimmer-vm-debug-macros',
    ],
  ];
};
