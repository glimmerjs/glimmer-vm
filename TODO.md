- [ ] Implement `#try` that takes handler
  - [ ] internal `{{#if isClear}}{{!-- actual code --}}{{/if}}`
  - [ ] if an error is encountered, unwind as-if isClear was false
        during the render pass
    - [ ] when you encounter the enter of the try, insert a marker in
          every VM stack.
    - [ ] every stack in the VM needs "unwind to nearest marker"
    - [ ] when a render error is encountered, unwind all the stacks
    - [ ] call the handler with the error
  - [ ] no catch
  - [ ] the handler has a way to clear the error
  - [ ] deal with user destructors that should run even during render errors
    - [ ] maintain the invariant that constructors and destructors are paired
