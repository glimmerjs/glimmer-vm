# Error Recovery

Error recovery is a feature of the Glimmer VM that allows the VM to recover from errors in user code.

## Table of Contents

1. [Conceptually](#conceptually)
1. [Internal Stacks](#internal-stacks)
1. [The Unwind Pointer](#the-unwind-pointer)
1. [The ErrorBoundary Internal Construct](#the-errorboundary-internal-construct)
1. [Modelled as a Conditional](#modelled-as-a-conditional)

## Conceptually

Conceptually, this feature makes it possible to create an unwind boundary in the VM. When an error occurs inside of an unwind boundary, the VM will clear its internal stack back to the unwind pointer.

## Internal Stacks

## The Unwind Pointer

## The ErrorBoundary Internal Construct

You wrap an error boundary (internally `{{#-try}}`) around an area of your application that you want to recover from.

The `#-try` control flow construct takes a single parameter (`handler`).

When an error occurs inside an error boundary, the handler's `catch` method will be called (after the render cycle has completed) with the error and a `retry` function.

Once an error has occurred, the `#-try`'s `else` block is rendered. The `catch` method can set reactive state (normally tracked properties) to customize the behavior of the `else` block.

If an error occurs inside the `else` block, nothing will be rendered.

### Clearing the Error

Once the application is prepared to retry rendering the contents of the `#error-boundary`, it calls the `retry` function. This will cause the error boundary to render the boundary again.

### Internally a Conditional

Internally, the error boundary behaves something like this:

```hbs
{{#let (-error-state) as |state|}}
  {{#if state.errored}}
    {{yield to='else'}}
  {{else}}
    {{#-error-boundary handler=handler}}
      {{yield}}
    {{/-error-boundary}}
  {{/if}}
{{/let}}
```

When you call the `retry` function, it sets `state.errored` to `false`, which will cause the .

### The Handler

```ts
interface Handler {
  catch: (error: Error, retry: () => void) => void;
}
```

## Modelled as a Conditional

Consider this (hypothetical) gjs component:

```tsx
class MyComponent {
  @tracked error;

  handler = {
    catch: (error, retry) => {
      this.error = error;

      setTimeout(() => {
        retry();
      })
    },

    clear: () => {
      this.error = null;
    }
  }

  get doit() {
    if (Math.random() > 0.5) {
      throw Error('An error occurred');
    }

    return "Everything works!";
  }

  <template>
    {{#try this.handler}}
      {{this.doit}}
    {{else}}
      An error occurred: {{this.error}}
    {{/try}}
  </template>
}
```

Internally, the `#try` block behaves something like this:

```tsx
  @tracked error;

  handler = {
    catch: (error, retry) => {
      this.error = error;

      setTimeout(() => {
        retry();
      })
    },

    clear: () => {
      this.error = null;
    }
  }

  get doit() {
    if (Math.random() > 0.5) {
      throw Error('An error occurred');
    }

    return "Everything works!";
  }

  <template>
    {{#let (-create-error-cell) as |cell|}}
      {{#-error-boundary}}
        {{#if cell.error}}
          An error occurred: {{this.error}}
        {{else}}
          {{this.doit}}
        {{/else}}
      {{/-error-boundary}}
    {{/let}}
  </template>
}
```
