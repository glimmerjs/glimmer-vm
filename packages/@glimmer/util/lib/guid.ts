let GUID = 0;

export interface HasGuid {
  _guid: number;
}

export function initializeGuid(object: HasGuid): number {
  return (object._guid = ++GUID);
}

export function ensureGuid(object: HasGuid): number {
  return typeof object._guid !== 'number' ? initializeGuid(object) : object._guid;
}
