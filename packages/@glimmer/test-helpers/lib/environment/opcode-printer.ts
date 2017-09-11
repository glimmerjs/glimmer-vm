import { ConstantPool, WriteOnlyProgram } from "@glimmer/program";
import { BundleCompiler, DebugConstants, specifierFor, LookupMap, Specifier } from "@glimmer/bundle-compiler";
import { BundlingDelegate, registerComponent, Modules } from './bundle-compiler';
import { TestMacros } from './generic/macros';
import { ComponentKind } from '../abstract-test-case';
import { Opaque, ProgramSymbolTable, VMHandle, Recast } from "@glimmer/interfaces";
import { assert, assign } from "@glimmer/util";
import { WrappedBuilder, logOpcode, debug, CompileTimeConstants } from "@glimmer/opcode-compiler";
import { EMBERISH_CURLY_CAPABILITIES } from './components/emberish-curly';

declare function require(id: string): any;

export class OpcodePrinter {
  private components = {};
  private compiler: BundleCompiler;
  private modules = new Modules();
  private compileTimeModules = new Modules();
  private speficiersToSymbolTable = new LookupMap<Specifier, ProgramSymbolTable>();
  registerComponent(type: ComponentKind, testType: ComponentKind, name: string, layout: string, Class?: Opaque) {
    registerComponent(this.components, type, testType, name, layout, Class);
  }

  print(name: string, template: string): GoldenCase {
    let delegate = new BundlingDelegate(this.components, this.modules, this.compileTimeModules, specifier => {
      return this.compiler.compileSpecifier(specifier);
    });
    let macros = new TestMacros();
    let program = new WriteOnlyProgram(new DebugConstants());
    this.compiler = new BundleCompiler(delegate, { macros, program });
    let spec = specifierFor('ui/components/main', 'default');

    this.process(spec, template);
    let handle = this.compiler.getSpecifierMap().vmHandleBySpecifier.get(spec)! as Recast<number, VMHandle>;
    return {
      [name]: {
        snippet: template,
        opcodes: printHeap(program, handle),
        constantPool: program.constants.toPool()
      }
    };
  }

  regenerate(path: string) {
    if (typeof require === 'function') {
      /* tslint:disable:no-require-imports */
      const fs = require('fs');
      /* tslint:enable:no-require-imports */
      let golden: GoldenCases = JSON.parse(fs.readFileSync(path, 'utf8'));
      let newCases = { cases: {} };
      Object.keys(golden.cases).forEach((name) => {
        let snippet = golden.cases[name].snippet;
        let setupPath = golden.cases[name].setupPath;
        if (setupPath) {
          /* tslint:disable:no-require-imports */
          const { setup } = require(setupPath);
          setup(this);
          /* tslint:enable:no-require-imports */
        }
        let newGolden = this.print(name, snippet);
        assign(newCases.cases, newGolden);
      });
      fs.writeFileSync(path, JSON.stringify(newCases));
    }
  }

  private process(spec: Specifier, template: string) {
    let { compiler } = this;
    compiler.add(spec, template);

    let { components, modules, compileTimeModules } = this;
    Object.keys(components).forEach(key => {
      assert(key.indexOf('ui/components') !== -1, `Expected component key to start with ui/components, got ${key}.`);

      let component = components[key];
      let spec = specifierFor(key, 'default');

      let block;
      let symbolTable;

      if (component.type === "Curly" || component.type === "Dynamic") {
        let block = compiler.preprocess(spec, component.template);
        let options = compiler.compileOptions(spec);
        let parsedLayout = { block, referrer: spec };
        let wrapped = new WrappedBuilder(options, parsedLayout, EMBERISH_CURLY_CAPABILITIES);
        compiler.addCustom(spec, wrapped);

        compileTimeModules.register(key, 'other', {
          default: wrapped.symbolTable
        });

        symbolTable = wrapped.symbolTable;
      } else {
        block = compiler.add(spec, component.template);

        symbolTable = {
          hasEval: block.hasEval,
          symbols: block.symbols,
          referrer: key,
        };

        this.speficiersToSymbolTable.set(spec, symbolTable);

        compileTimeModules.register(key, 'other', {
          default: symbolTable
        });
      }

      if (component.definition.symbolTable) {
        modules.register(key, 'component', {
          default: {
            definition: assign({}, component.definition, { symbolTable }),
            manager: component.manager
          }
        });
      } else {
        modules.register(key, 'component', { default: { definition: component.definition, manager: component.manager } });
      }
    });

    compiler.compile();
  }
}

function printHeap(program: WriteOnlyProgram, handle: VMHandle): string[] {
  let start = program.heap.getaddr(handle);
  let end = start + program.heap.sizeof(handle);
  let { constants } = program;
  let _size = 0;

  let out = [];
  for (let i=start; i < end; i = i + _size) {
    let { type, op1, op2, op3, size } = program.opcode(i);
    let [name, params] = debug(constants as Recast<CompileTimeConstants, DebugConstants>, type, op1, op2, op3);
    out.push(`${i}. ${logOpcode(name, params)}`);
    _size = size;
  }

  return out;
}

export interface GoldenCases {
  cases: GoldenCase;
}

export interface GoldenCase {
  [key: string]: Golden;
}

export interface Golden {
  snippet: string;
  setupPath?: string;
  opcodes: string[];
  constantPool: ConstantPool;
}
