# Dynamic Resolution

These features support dynamic resolution in Ember.

When fully using Embroider and `<template>`, these features are not used.

## Glimmer Resolver

Ember implements the Glimmer Resolver interface for dynamic resolution. It is only relevant when using dynamic resolution.

In the unlikely event that we end up with a feature like Vue's global components, they would probably still use the Glimmer resolver, but the implementation would be dramatically simpler.

## Helpers

### `-resolve`

This helper is used to resolve an owner lookup and is only relevant when using dynamic resolution.
