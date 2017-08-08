
import { ModifierManager, CapturedArguments, IDOMChanges, Arguments, DynamicScope, DOMTreeConstruction } from "@glimmer/runtime";
import { Opaque, Option } from "@glimmer/interfaces";
import { Tag, CONSTANT_TAG } from "@glimmer/reference";
import { Destroyable } from "@glimmer/util";

export class InertModifierManager implements ModifierManager<Opaque> {
  create() { }

  getTag(): Tag {
    return CONSTANT_TAG;
  }

  install() { }

  update() { }

  getDestructor(): Option<Destroyable> {
    return null;
  }
}

export class TestModifier {
  constructor(
    public element: Element,
    public args: CapturedArguments,
    public appendOperations: DOMTreeConstruction,
    public updateOperations: IDOMChanges
  ) { }
}

export class TestModifierManager implements ModifierManager<TestModifier> {
  public installedElements: Element[] = [];
  public updatedElements: Element[] = [];
  public destroyedModifiers: TestModifier[] = [];

  create(element: Element, args: Arguments, _dynamicScope: DynamicScope, appendOperations: DOMTreeConstruction, updateOperations: IDOMChanges): TestModifier {
    return new TestModifier(element, args.capture(), appendOperations, updateOperations);
  }

  getTag({ args: { tag } }: TestModifier): Tag {
    return tag;
  }

  install({ element, args, appendOperations }: TestModifier) {
    this.installedElements.push(element);

    let param = args.positional.at(0).value();
    appendOperations.setAttribute(element, 'data-modifier', `installed - ${param}`);

    return;
  }

  update({ element, args, updateOperations }: TestModifier) {
    this.updatedElements.push(element);

    let param = args.positional.at(0).value();
    updateOperations.setAttribute(element, 'data-modifier', `updated - ${param}`);

    return;
  }

  getDestructor(modifier: TestModifier): Destroyable {
    return {
      destroy: () => {
        this.destroyedModifiers.push(modifier);
        let { element, updateOperations } = modifier;
        updateOperations.removeAttribute(element, 'data-modifier');
      }
    };
  }
}
