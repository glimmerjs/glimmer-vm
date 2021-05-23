import { getPath, setPath } from '@glimmer/global-context';
import { isDict } from '@glimmer/util';
import { CapturedArguments } from '@glimmer/interfaces';
import { UNDEFINED_SOURCE, createUpdatableCacheSource } from '@glimmer/reference';
import { getValue } from '@glimmer/validator';
import { internalHelper } from './internal-helper';

/**
  Dynamically look up a property on an object. The second argument to `{{get}}`
  should have a string value, although it can be bound.

  For example, these two usages are equivalent:

  ```app/components/developer-detail.js
  import Component from '@glimmer/component';
  import { tracked } from '@glimmer/tracking';

  export default class extends Component {
    @tracked developer = {
      name: "Sandi Metz",
      language: "Ruby"
    }
  }
  ```

  ```handlebars
  {{this.developer.name}}
  {{get this.developer "name"}}
  ```

  If there were several facts about a person, the `{{get}}` helper can dynamically
  pick one:

  ```app/templates/application.hbs
  <DeveloperDetail @factName="language" />
  ```

  ```handlebars
  {{get this.developer @factName}}
  ```

  For a more complex example, this template would allow the user to switch
  between showing the user's height and weight with a click:

  ```app/components/developer-detail.js
  import Component from '@glimmer/component';
  import { tracked } from '@glimmer/tracking';

  export default class extends Component {
    @tracked developer = {
      name: "Sandi Metz",
      language: "Ruby"
    }

    @tracked currentFact = 'name'

    showFact = (fact) => {
      this.currentFact = fact;
    }
  }
  ```

  ```app/components/developer-detail.js
  {{get this.developer this.currentFact}}

  <button {{on 'click' (fn this.showFact "name")}}>Show name</button>
  <button {{on 'click' (fn this.showFact "language")}}>Show language</button>
  ```

  The `{{get}}` helper can also respect mutable values itself. For example:

  ```app/components/developer-detail.js
  <Input @value={{mut (get this.person this.currentFact)}} />

  <button {{on 'click' (fn this.showFact "name")}}>Show name</button>
  <button {{on 'click' (fn this.showFact "language")}}>Show language</button>
  ```

  Would allow the user to swap what fact is being displayed, and also edit
  that fact via a two-way mutable binding.

  @public
  @method get
 */
export default internalHelper(({ positional }: CapturedArguments) => {
  let objSource = positional[0] ?? UNDEFINED_SOURCE;
  let pathSource = positional[1] ?? UNDEFINED_SOURCE;

  return createUpdatableCacheSource(
    () => {
      let obj = getValue(objSource);

      if (isDict(obj)) {
        return getPath(obj, String(getValue(pathSource)));
      }
    },
    (value) => {
      let obj = getValue(objSource);

      if (isDict(obj)) {
        return setPath(obj, String(getValue(pathSource)), value);
      }
    },
    'get'
  );
});
