import type { HelperManager } from '@glimmer/state';

export interface HelperCapabilitiesVersions {
  '3.23': {
    hasValue?: boolean;
    hasDestroyable?: boolean;
  };
}

export interface HelperManagerWithValue<HelperStateBucket>
  extends HelperManager<HelperStateBucket> {
  getValue(bucket: HelperStateBucket): unknown;
}

export interface HelperManagerWithDestroyable<HelperStateBucket>
  extends HelperManager<HelperStateBucket> {
  getDestroyable(bucket: HelperStateBucket): object;
}
