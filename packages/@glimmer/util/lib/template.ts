import type { ErrHandle, HandleResult, OkHandle, Template, TemplateOk } from '@glimmer/interfaces';

export function unwrapHandle(handle: HandleResult): number {
  if (import.meta.env.DEV) {
    if (typeof handle === 'number') {
      return handle;
    } else {
      let error = handle.errors[0];
      throw new Error(`Compile Error: ${error.problem} @ ${error.span.start}..${error.span.end}`);
    }
  }

  // TODO: Verify that we don't expect this failure to happen in production
  return handle as number;
}

export function unwrapTemplate(template: Template): TemplateOk {
  if (import.meta.env.DEV) {
    if (template.result === 'error') {
      throw new Error(
        `Compile Error: ${template.problem} @ ${template.span.start}..${template.span.end}`
      );
    }
  }

  // TODO: Verify that we don't expect this failure to happen in production
  return template as TemplateOk;
}

export function extractHandle(handle: HandleResult): number {
  if (typeof handle === 'number') {
    return handle;
  } else {
    return handle.handle;
  }
}

export function isOkHandle(handle: HandleResult): handle is OkHandle {
  return typeof handle === 'number';
}

export function isErrHandle(handle: HandleResult): handle is ErrHandle {
  return typeof handle === 'number';
}
