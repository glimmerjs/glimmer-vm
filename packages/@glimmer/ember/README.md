This package exists to explicitly call out what ember is depending on.
Keeps us honest as VM-refactors happen.

_Do not use `export *` in this package_


These are all the things that ember depends on to tie in to Glimmer.

NOTE these are observed by babel and can't be re-exported here
- @glimmer/env

NOTE: these do not live in the VM repo
- @glimmer/component
- @glimmer/tracking

