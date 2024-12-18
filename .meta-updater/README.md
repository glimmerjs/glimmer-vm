# Glimmer VM's Meta Updater Setup

`@pnpm/meta-updater` helps keep the config files at the root of each package up to date.

## Running `meta-updater`

To update the config files:

```bash
$ pnpm meta-updater
```

> [!NOTE]
>
> #### You don't need to do this manually
>
> Our `turbo` setup will run `meta-updater` before running other commands, and our dev
> workflows go through `turbo`.

To check what files are out of sync:

```bash
$ pnpm meta-updater --test
```

> [!WARNING]
>
> #### Don't use `--test` in development
>
> The `meta-updater --test` command returns a non-zero exit code if the config files are out
> of sync. This might be useful in CI, but in local workflows, it makes more sense to just run the
> `meta-updater` command before running other commands, and that's what our `turbo` setup does.

## Managed Config Files

Our `meta-updater` setup keeps the following files up to date:

<table>
  <tr><td><code>package.json</code></td></tr>
  <tr><td><code>tsconfig.json</code></td></tr>
  <tr><td><code>rollup.config.mjs</code></td></tr>
</table>

> [!TIP]
>
> You **should not** modify the `rollup.config.js` or `tsconfig.json` files in a package manually.
> These files are fully managed by `meta-updater` and will be updated automatically when the sources
> of truth change.
>
> You **will** modify the [Source of Truth](#sources-of-truth) fields in `package.json` in order to
> control the behavior of `meta-updater`.

## Sources of Truth

`meta-updater` uses a handful of sources of truth to determine what to update. These sources of truth are manually edited and serve as _inputs_ into our `meta-updater` setup and are **not managed by** `meta-updater`.

- Most of the configuration is controlled by `package.json` (see [below](#in-packagejson)).
- The presence of a `tests/` directory means that the package [**Needs Types**](#needs-types): `qunit`.

### In `package.json`

| Field                    | Condition                                  | Result                                                                                             |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `"files"`                | any                                        | Configures [**Included Files**](#included-files)                                                   |
| `"private"`              | is not `true`                              | <table><tr><td> ✅ [**Is Published**](#is-published) </td></table>                                 |
| `"name"`                 | is missing or starts with `@glimmer-test/` | <table><tr><td> ✅ [**Is Published**](#is-published) </td></table>                                 |
| `"exports"`              | is a `.ts` file                            | <table><tr><td> ☑️ [**Needs a Build**](#needs-a-build) </td><td> _if published_ </td></tr></table> |
| `"keywords"` [^keywords] | includes `"node"`                          | <table><tr><td> [**Needs Types**](#needs-types) </td><td> `node` </td></tr></table>                |
| `"keywords"`             | includes `"test-utils"` [^test-utils]      | <table><tr><td> [**Needs Types**](#needs-types) </td><td> `qunit` </td></tr></table>               |

### Special Cases

There are a handful of special cases that are handled by the `meta-updater` setup. These
special cases should be removed once the setup is stable.

| Field    | Condition                        | Result                              |
| -------- | -------------------------------- | ----------------------------------- |
| `"type"` | `= "commonjs"`                   | No tsconfig [^cjs-ts]               |
| `"name"` | is `@glimmer-workspace/krausest` | No `catalog:` dependencies [^bench] |

[^keywords]: Keywords are used in unpublished packages only to opt-in to specific behaviors.
[^cjs-ts]: In practice, this is limited to the `eslint-plugin` package, which can't be linted using the lint plugin anyway. More generally, CJS packages require a very different config setup than the rest of the repo, and it's not worth the effort to script the setup just for the eslint plugin.
[^tests-ts]: Test packages use the `tsconfig` files in their parent packages.
[^bench]: Since the same setup is used in the benchmark control, we can't use `catalog:` dependencies until this PR is merged. After merging, we can use `catalog:` dependencies in `@glimmer-workspace/krausest` and get the benefit of using the version specified by the control repo.
[^test-utils]: Test utils aren't tests themselves, but they need the test types to write functions using the test infrastructure that can be _used_ in tests.

---

## Package Properties

### Is Published

When a package is public, it gets:

| Location       | Field                       | Value                               |
| -------------- | --------------------------- | ----------------------------------- |
| `package.json` | `"scripts.build"`           | `rollup.config.mjs`                 |
|                | `"scripts.test:publint"`    | `"publint"`                         |
|                | `"devDependencies.publint"` | `"catalog:"`                        |
|                | `"publishConfig.files"`     | `["dist"]`                          |
|                | `"repostitory"`             | see [Repository](#repository) below |

> [!NOTE]
>
> These entries are removed if unused, **except for the scripts in the root package**. This is because the
> root package has custom versions of the scripts that delegate to the other packages via turbo.

#### Repository

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/glimmerjs/glimmer-vm.git",
    "directory": "packages/<package-name>"
  }
}
```

### Needs a Build

If a _published package_ also **needs a build**, it gets:

| Location           | Field                   | Value                                               |
| ------------------ | ----------------------- | --------------------------------------------------- |
| `rollup.config.js` | Boilerplate             | See [Boilerplate](#rollup-boilerplate) below        |
| `package.json`     | `"scripts.build"`       | `rollup.config.mjs`                                 |
| "                  | `"devDependencies"`     | `"@glimmer-workspace/build-support": "workspace:*"` |
| "                  | "                       | `"rollup": "catalog:*"`                             |
| "                  | `"publishConfig"`       | See [Boilerplate](#publishconfig-boilerplate) below |
| "                  | `"publishConfig.files"` | `["dist"]`                                          |

> [!NOTE]
>
> These entries are removed if they exist but the package is not a published package that needs a
> build.
>
> For reference, all published packages except `@glimmer/interfaces` need a build.

### Needs Types

If a package **needs types**, it the type name is included in `types` in `tsconfig.json` and the associated package is included in `devDependencies` in `package.json`.

| Name    | `@types/` dependency |
| ------- | -------------------- |
| `node`  | `@types/node`        |
| `qunit` | `@glimmer/qunit`     |

### Included Files

This is the list of files that are `include`d in `tsconfig.json`.

By default, this includes the following files (relative to the package root), if they exist:

- `index.*`
- `lib/`
- `test/`

> Packages may _configure_ the list of included files in the `files` field of their `package.json`. For example, the `bin` package has the following `files` field:
>
> ```json
> {
>   "files": ["*.mjs", "*.mts", "opcodes"]
> }
> ```
>
> This is meant to be used in edge-cases like the `bin` package or the benchmark package. Most packages should use the default included files and not specify any `files` field.

> [!NOTE]
> Note that the `publishConfig.files` field is managed automatically by `meta-updater` and _should not_ be updated manually.

---

## Boilerplate

### Rollup Boilerplate

```ts
import { Package } from "@glimmer-workspace/build-support";

export default Package.config(import.meta);
```

> [!TIP]
>
> This boilerplate is intentionally simple and delegates to the `@glimmer-workspace/build-support`
> package. Anything that customizes the behavior of the build should be done in the
> `@glimmer-workspace/build-support` package.

#### `publishConfig` Boilerplate

This boilerplate makes the `dist/dev` the directory for development builds and `dist/prod` for production builds. Production build are the default.

```json
{
  "access": "public",
  "exports": {
    "development": {
      "types": "./dist/dev/index.d.ts",
      "default": "./dist/dev/index.js"
    },
    "default": {
      "types": "./dist/prod/index.d.ts",
      "default": "./dist/prod/index.js"
    }
  },
  "files": ["dist"]
}
```

> [!NOTE]
>
> This boilerplate is not customizable, instead relying on the build conventions of the monorepo. If
> we want to support more entry points in the future, we will likely do so by allowing the top-level
> `exports` field to have multiple entries, each of which gets mapped to an entry in
> `publishConfig.exports`.
