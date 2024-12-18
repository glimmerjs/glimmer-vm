export class StdLib {
  constructor(
    public main: number,
    private trustingGuardedAppend: number,
    private cautiousGuardedAppend: number,
    private trustingNonDynamicAppend: number,
    private cautiousNonDynamicAppend: number
  ) {}

  get 'trusting-append'(): number {
    return this.trustingGuardedAppend;
  }

  get 'cautious-append'(): number {
    return this.cautiousGuardedAppend;
  }

  get 'trusting-non-dynamic-append'(): number {
    return this.trustingNonDynamicAppend;
  }

  get 'cautious-non-dynamic-append'(): number {
    return this.cautiousNonDynamicAppend;
  }

  getAppend(trusting: boolean): number {
    return trusting ? this.trustingGuardedAppend : this.cautiousGuardedAppend;
  }
}
