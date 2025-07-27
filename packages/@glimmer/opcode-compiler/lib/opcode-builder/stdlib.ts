export class StdLib {
  constructor(
    public main: number,
    private trustingGuardedAppend: number,
    private cautiousGuardedAppend: number,
    private trustingNonDynamicAppend: number,
    private cautiousNonDynamicAppend: number,
    private trustingDynamicHelperAppend: number,
    private cautiousDynamicHelperAppend: number
  ) {}

  get 'trusting-append'() {
    return this.trustingGuardedAppend;
  }

  get 'cautious-append'() {
    return this.cautiousGuardedAppend;
  }

  get 'trusting-non-dynamic-append'() {
    return this.trustingNonDynamicAppend;
  }

  get 'cautious-non-dynamic-append'() {
    return this.cautiousNonDynamicAppend;
  }

  getAppend(trusting: boolean) {
    return trusting ? this.trustingGuardedAppend : this.cautiousGuardedAppend;
  }

  get 'trusting-dynamic-helper-append'() {
    return this.trustingDynamicHelperAppend;
  }

  get 'cautious-dynamic-helper-append'() {
    return this.cautiousDynamicHelperAppend;
  }
}
