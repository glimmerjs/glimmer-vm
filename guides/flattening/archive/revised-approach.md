# Revised Expression Flattening Approach

Based on our Step 4 findings, here's the updated plan:

## Completed Steps

1. **Step 1**: Add arity tracking ✅
2. **Step 2**: Implement stack-based arguments ✅
3. **Step 3**: Attempted VM_PUSH_HELPER_OP (postponed) ❌
4. **Step 4**: Attempted frame removal (not feasible) ❌

## Revised Plan

### Keep Frames
After investigation, we discovered that frames are integral to the Arguments system. The $sp register is used to calculate argument positions throughout the codebase. Removing frames would require a major redesign of the Arguments system.

### New Step 3: Implement VM_PUSH_HELPER_OP with Frames
Now that we understand frames must stay, we can implement VM_PUSH_HELPER_OP properly:

1. Create VM_PUSH_HELPER_OP that pushes results to stack
2. Update ALL helper-related operations simultaneously:
   - CallResolved
   - CallDynamicValue  
   - Any other helper invocations
3. Remove VM_FETCH_OP for helper results

### Benefits We Still Achieve

1. **Stack-based arguments** - Already working, major improvement
2. **Direct stack push** - Eliminates $v0 register for helpers
3. **Cleaner data flow** - Arguments and results both use stack
4. **Future ready** - When Arguments system is redesigned, we can remove frames

### What We Learned

1. Incremental migration has limits - some systems are too intertwined
2. The VM's calling convention is fundamental and affects many subsystems
3. Stack-based arguments alone provide significant value
4. Frame removal should be a separate, dedicated project

## Next Action

Implement VM_PUSH_HELPER_OP accepting that frames will remain. This still provides value by eliminating the $v0 register for helper results.