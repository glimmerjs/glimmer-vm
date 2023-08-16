import type { HandleResult, TemplateCompilationContext } from "@glimmer/interfaces";
import { logOpcodeSlice } from '@glimmer/debug';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { extractHandle } from '@glimmer/util';

export let debugCompiler: (context: TemplateCompilationContext, handle: HandleResult) => void;

if (LOCAL_TRACE_LOGGING) {
  debugCompiler = (context: TemplateCompilationContext, result: HandleResult) => {
    let handle = extractHandle(result);
    let { heap } = context.program;
    let start = heap.getaddr(handle);
    let end = start + heap.sizeof(handle);

    logOpcodeSlice(context, start, end);
  };
}
