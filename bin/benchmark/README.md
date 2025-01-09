# Benchmark Runner

In broad strokes, the benchmark runner:

1. Creates a temporary directory for each scenario: <kbd>control</kbd> and <kbd>experiment</kbd>.
   1. The <kbd>control</kbd> directory is a clone of the `HEAD` of `origin/main`.
   2. The <kbd>experiment</kbd> directory is a clone of the `HEAD` of the current `glimmer-vm`
      checkout
2. Copies the `benchmark/` directory from the current `glimmer-vm` checkout into the scenario
   directories.
3. Simulate publishing the packages in each scenario's directories. <sup id="ret-simulate">[[a better idea?]](#improving-publish-simulation)</sup>
   1. `pnpm install`
   2. `pnpm build`
   3. Rewrite the `package.json` files for each published package by copying its `publishConfig`
      fields into the root of the package.
4. Builds and serves the `krausest` benchmark app for each scenario.
   1. Builds the app using `vite build`. The `vite.config.mts` file in the `krausest` directory
      controls the build process, using the production packages. <sup id="ret-build-krausest">[[a better idea?]](#improving-build-krausest)</sup>
   2. Serves the `krausest` benchmark app for each scenario using `vite preview`.
5. Connects to each of the servers using `tracerbench`, runs the benchmarks, and reports the
   results.

## Scenario Configuration

|      | <kbd>control</kbd> | <kbd>experiment</kbd> |                                    |
| ---- | ------------------ | --------------------- | ---------------------------------- |
| port | 4200               | 4201                  | the port to serve on [^serve-port] |
| ref  | `origin/main`      | workspace `HEAD`      |

[^serve-port]:
    The benchmarks are served with `vite preview` using `strictPort` mode, which means
    that the benchmarks will fail if the port is already in use. This could (and should) be adjusted so
    that the selected port is used dynamically by the `tracerbench` script. Using the [createServer]
    API would help, and would probably make other parts of the setup simpler as well.

[createServer]: https://vite.dev/guide/api-javascript.html#createserver

## Local Development

To facilitate local development, you can:

1. Run the benchmarks _without rebuilding them_ from scratch
2. Run the benchmarks in _offline mode_, which avoids network updates
3. Run the server but _not the benchmarks_. This allows you to run the benchmarks in the browser
   manually to profile them or use the developer tools to debug them.
4. _Don't run the server_ at all.

These features are controlled by [build modes](#build-modes), [serve modes](#serve-modes), and the
<kbd>offline</kbd> flag passed as flags to the `setup-bench.mjs` CLI command.

The <kbd>control</kbd> and <kbd>experiment</kbd> scenarios can be controlled separately.

## CLI Flags

```asciidoc
Usage
  $ *pnpm* benchmark:setup [options]

Options
  --help                    Prints this help and exits.
  --no-serve-control        Set up the control scenario but do not serve it
  --no-serve-experiment     Set up the experiment scenario but do not serve it
  --offline                 Run the benchmark with local state (without fetching the repo or packages)
  --reuse []                Reuse the existing /tmp directory for these scenarios
  --run-control [reset]     How to run the control scenario (none, repeat, rebuild, reset)
  --run-experiment [reset]  How to run the experiment scenario (none, repeat, rebuild, reset)
  --version                 Prints current version and exits.
```

## Detailed Behavior

### Benchmark Harness Setup

1.  Unless <kbd>offline</kbd>, run `git fetch` in the root of the `glimmer-vm` checkout (the "workspace").

### Build Modes

The build mode controls which steps are run. The default is `reset`.

<dl>
<dt> <a href="#none">none</a> </dt>
<dd>Do nothing at all for this scenario.</dd>
<dt> <a href="#repeat">repeat</a> </dt>
<dd>
  Update the scenario from the workspace's `HEAD`, and update `benchmark/` from the workspace.</li>
</dd>
<dt> <a href="#rebuild">rebuild</a> </dt>
<dd>Update the scenario and and rebuild the packages and benchmarks.</dd>
<dt> <a href="#reset">reset</a> <em>(default)</em> </dt>
<dd>Delete the scenario checkout and recreate it from scratch.</dd>
</dl>

### Details

More specifically, this is the behavior of the build modes for each scenario:

|                      |            Repeat            |          Rebuild          |        Reset        |
| -------------------- | :--------------------------: | :-----------------------: | :-----------------: |
| **Reset**            |              ·               |             ·             |      `rm -rf`       |
| **Create**           |              ·               |        `mkdir -p`         |         👈          |
| **Clone**            |       `fetch` [^fetch]       |    `fetch` or `clone`     |       `clone`       |
| **`pnpm install`**   |              ·               | `pnpm install` [^install] |         👈          |
| **`pnpm build`**     |              ·               |   `pnpm build` [^build]   |         👈          |
| **Simulate Publish** |              ·               |             ·             | simulate [^publish] |
| **Bench Dir**        | update `benchmark/` [^bench] |            👈             |         👈          |
| **Build Benchmarks** |         `vite build`         |            👈             |         👈          |

[^fetch]:
    This fetches the `.git` database from the glimmer-vm repository into the temporary
    directory for the scenario.

[^bench]:
    Currently, this removes the `benchmark/` directory,
    copies it from the glimmer-vm checkout, and removes `node_modules/` and
    `benchmarks/krausest/node_modules/`, which will be repopulated by the `pnpm install` step.

[^install]:
    This runs `pnpm install` with `--no-frozen-lockfile` and
    `--no-strict-peer-dependencies` so that it runs properly in the `control` scenario with `benchmark/`
    package transplanted from the current `glimmer-vm` checkout.

[^build]:
    This is managed through `turbo` and therefore should be
    fast in `rebuild` mode.

[^publish]: Copy the `publishConfig` fields from the `package.json`s

<sup><kbd><a name="ref-offline">offline</a></kbd></sup> In offline mode, this runs `pnpm install` with `--offline`.

### Build Mode: none

Don't clone or build the scenario at all.

> [!TIP]
>
> This is useful if you're debugging a problem in the build of one specific scenario and don't want
> to have to worry about the other one.
>
> It's also useful to set the <kbd>control</kbd> build mode to
> `none` if you want to run the `experiment` benchmark in the browser for profiling or debugging.

### Build Mode: repeat

Repeat the last run of the scenario, minimizing rebuild work.

This is useful in two situations:

1. You want to re-run the benchmarks again to verify the results.
2. You made changes to the `benchmark/` directory and want to update the scenarios with those changes.

This does **not** rebuild the packages or simulate publishing them, but it **does** rebuild the benchmarks.

### Build Mode: rebuild

Update and rebuild the scenario's packages and benchmarks.

This:

1. fetches the refe

### Build Mode: reset

## Serve Modes

### Serve: None

## Potential Improvements

### Improving Publish Simulation <a href="#ret-simulate" name="ref-simulate">↩</a>

The benchmark runner currently simulates publishing the packages in each scenario's directories in a
multi-step process that probably gets close enough. But maybe we should just use `pnpm pack` in each
directory and use the results

### Improving the Krausest Build <a href="#ret-build-krausest" name="ref-build-krausest">↩</a>

We currently use `vite build` to build the Krausest benchmark app.

This build has several customizations:

1. <kbd>rewrite VM_LOCAL_DEV</kbd> `import.meta.env.VM_LOCAL_DEV` is rewritten to `false`. (is this still needed?)
2. <kbd>rewrite @glimmer/env</kbd> `@glimmer/env` is rewritten to `export const DEBUG = false`. This
   emulates the expected behavior of environments (like Ember) that include the built packages.
3. <kbd>compile hbs</kbd> `hbs` files in the benchmark directory are compiled using the
   `@glimmer/compiler` custom package in the scenario directory.
4. <kbd>terser optimizations</kbd> The benchmark build is compiled using `keep_fargs: false` and `keep_fnames: false` in the terser
   options, which emulates the expected behavior of environments (like Ember) in production mode,
   and which is required to get optimal inlining behavior.
5. <kbd>vite aliases</kbd> The packages used by the benchmark runtime are registered as Vite aliases.

Some of these customizations make sense and simply reflect what we expect production environments to
do.

A quick summary:

|                                 | what          | reason                                                             |
| ------------------------------- | ------------- | ------------------------------------------------------------------ |
| <kbd>VM_LOCAL_DEV</kbd>         | :scissors:    | probably not neeeded anymore, since the builds should remove these |
| <kbd>@glimmer/env</kbd>         | :wrench:      | see [Improving <kbd>@glimmer/env</kbd>](#improving-glimmerenv)     |
| <kbd>vite aliases</kbd>         | :wrench:      | see [Improving Vite Aliases](#improving-vite-aliases]              |
| <kbd>compile hbs</kbd>          | :floppy_disk: | this is necessary                                                  |
| <kbd>terser optimizations</kbd> | :floppy_disk: | this is necessary                                                  |

|               |             |
| ------------- | ----------- |
| :scissors:    | remove this |
| :wrench:      | fix this    |
| :floppy_disk: | keep this   |

### Improving <kbd>@glimmer/env</kbd>

The `@glimmer/env` package is a _real_ npm package that was last updated in 2017.

It contains this code in `dist/modules/es2017/index.js`:

```js
export const DEBUG = false;
export const CI = false;
```

It has no dependencies and these entry points specified in `package.json`:

```json
"main": "dist/commonjs/es5/index.js",
"module": "dist/modules/es2017/index.js",
"types": "dist/types/index.d.ts",
```

_In practice, though, this package is used as a marker by other build tools, and rewritten as
needed._

#### Recommendation

We should update the published version of this package with these changes:

1. Use `exports` to document the entry points
2. Use [standard conditions](https://nodejs.org/api/packages.html#community-conditions-definitions)
   to specify different development and production entry points.

If we do that, and especially if we move the `@glimmer/env` package to the `glimmer-vm` repository,
then we won't need anything special in the Vite build.

> [!NOTE]
> Getting this to work properly in Ember (at least for Embroider) requires verifying that Embroider
> builds properly set the appropriate condition. That should take care of itself in Vite builds, but
> might need additional work for Webpack builds?

### Improving <kbd>vite aliases</kbd>

Currently, the Vite build that runs the benchmarks has these aliases (see
[vite.config.mts](../../benchmark/benchmarks/krausest/vite.config.mts#aliases) in the `krausest` directory):

```js
{
  resolve: {
    alias: {
      '@glimmer-workspace/benchmark-env': '@glimmer-workspace/benchmark-env/index.ts',
      '@glimmer/runtime': packagePath('@glimmer/runtime'),
      '@glimmer/compiler': packagePath('@glimmer/compiler'),
      '@/components': path.join(currentPath, 'lib', 'components'),
      '@/utils': path.join(currentPath, 'lib', 'utils'),
    }
  }
}
```

There is no reason that `runtime` or `compiler` should be aliased rather than be properly installed.
If we [used `pnpm pack`](#use-pnpm-pack) rather than simulating publishing, we could simply install
the `tgz`s that `pnpm pack` produces directly in `krausest`'s `package.json`.

`benchmark-env` is an unpublished package -- TODO: do we need to alias because vite won't transpile
it otherwise?

`@/components` and `@/utils` are app aliases, but:

1. They're also aliases in `tsconfig.json`, so at minimum we should use
   [vite-tsconfig-paths](https://www.npmjs.com/package/vite-tsconfig-paths) to avoid duplication.
2. We probably could use [subpath imports](https://nodejs.org/api/packages.html#subpath-imports)
   in `package.json` (i.e. `#components` and `#utils`), depending on whether there's support for
   them in Vite and TypeScript. (it looks like there's good support).

### Use `pnpm pack`

We currently simulate publishing the packages via these steps:

1. `pnpm install`
2. `pnpm build`
3. Rewrite the `package.json` files for each published package by copying its `publishConfig`
   fields into the root of the package.

We should instead use `pnpm pack` to generate the `tgz`s. We could either manually install them into
the `krausest` directory or consider using the [verdaccio node
API](https://verdaccio.org/docs/verdaccio-programmatically/) to fully emulate published packages.
