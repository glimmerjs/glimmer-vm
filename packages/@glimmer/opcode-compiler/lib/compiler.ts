import { debugSlice } from '@glimmer/debug';
import { type HandleResult, type TemplateCompilationContext } from '@glimmer/interfaces';
import { extractHandle } from '@glimmer/util';
import { LOCAL_SHOULD_LOG } from '@glimmer-workspace/local-debug-flags';

export let debugCompiler: (context: TemplateCompilationContext, handle: HandleResult) => void;

if (LOCAL_SHOULD_LOG) {
  debugCompiler = (context: TemplateCompilationContext, result: HandleResult) => {
    let handle = extractHandle(result);
    let { heap } = context.program;
    let start = heap.getaddr(handle);
    let end = start + heap.sizeof(handle);

    debugSlice(context, start, end);
  };
}
