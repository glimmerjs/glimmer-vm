import { Opaque, Simple } from '@glimmer/interfaces';
import { RuntimeProgram } from '@glimmer/program';
import { LinkedList, Option } from '@glimmer/util';
import { DestroyableBounds, clear } from '../bounds';
import Environment from '../environment';
import { UpdatingOpcode } from '../opcodes';
import UpdatingVM, { ExceptionHandler } from './update';

export default class RenderResult implements DestroyableBounds, ExceptionHandler {
  constructor(
    public env: Environment,
    private program: RuntimeProgram<Opaque>,
    private updating: LinkedList<UpdatingOpcode>,
    private bounds: DestroyableBounds
  ) {}

  rerender({ alwaysRevalidate = false } = { alwaysRevalidate: false }) {
    let { env, program, updating } = this;
    let vm = new UpdatingVM(env, program, { alwaysRevalidate });
    vm.execute(updating, this);
  }

  parentElement(): Simple.Element {
    return this.bounds.parentElement();
  }

  firstNode(): Option<Simple.Node> {
    return this.bounds.firstNode();
  }

  lastNode(): Option<Simple.Node> {
    return this.bounds.lastNode();
  }

  handleException() {
    throw new Error('this should never happen');
  }

  destroy() {
    this.bounds.destroy();
    clear(this.bounds);
  }
}
