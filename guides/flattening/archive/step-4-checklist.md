# Step 4 Implementation Checklist

## Pre-Implementation
- [ ] Review the plan and understand the changes
- [ ] Ensure all tests are passing (baseline)
- [ ] Create a git branch for Step 4

## Implementation
- [ ] Remove frames from CallResolved
  - [ ] Remove `encode.op(VM_PUSH_FRAME_OP)`
  - [ ] Remove `encode.op(VM_POP_FRAME_OP)`
  - [ ] Run tests
  
- [ ] Remove frames from CallDynamicValue
  - [ ] Remove `encode.op(VM_PUSH_FRAME_OP)`
  - [ ] Remove `encode.op(VM_POP_FRAME_OP)`
  - [ ] Run tests

- [ ] Check and update other helper uses
  - [ ] Log helper in expr.ts
  - [ ] Any other frame usage in expressions

## Verification
- [ ] Run full test suite
- [ ] Verify nested helper test passes
- [ ] Check stack-args-test.ts specifically
- [ ] Test in browser with `pnpm dev`

## Documentation
- [ ] Update proper-incremental-approach.md
- [ ] Create step-4-complete.md
- [ ] Update progress-summary.md

## Cleanup
- [ ] Remove any LOCAL_DEBUG logging if no longer needed
- [ ] Consider removing the frames TODO comments
- [ ] Prepare for Step 5 planning