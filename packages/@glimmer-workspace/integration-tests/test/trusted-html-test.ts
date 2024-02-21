import type { TrustedTypePolicy, TrustedTypesWindow } from 'trusted-types/lib';

import { jitSuite, RenderTest, test } from '..';

let policy: TrustedTypePolicy | undefined;
if (typeof window !== 'undefined') {
  let trustedTypes = (window as unknown as TrustedTypesWindow).trustedTypes;
  if (trustedTypes?.createPolicy) {
    policy = trustedTypes.createPolicy('test', {
      createHTML: (s: string) => s,
      createScript: (s: string) => s,
      createScriptURL: (s: string) => s,
    });
  }
}

export class TrustedHTMLTests extends RenderTest {
  static suiteName = 'TrustedHTML';

  @test
  'renders TrustedHTML similar to SafeString'() {
    if (!policy) return;

    let html = '<b>test\'"&quot;</b>';
    this.registerHelper('trustedHTML', () => {
      return policy?.createHTML(html);
    });

    this.render('<div>{{trustedHTML}}</div>');
    this.assertHTML('<div><b>test\'""</b></div');
    this.assertStableRerender();
  }

  @test
  'renders TrustedHTML in attribute context as string'() {
    if (!policy) return;

    let html = '<b>test\'"&quot;</b>';
    this.registerHelper('trustedHTML', () => {
      return policy?.createHTML(html);
    });

    this.render('<a title="{{trustedHTML}}">{{trustedHTML}}</a>');
    this.assertHTML('<a title="<b>test\'&quot;&amp;quot;</b>"><b>test\'""</b></a>');
    this.assertStableRerender();
  }
}

jitSuite(TrustedHTMLTests);
