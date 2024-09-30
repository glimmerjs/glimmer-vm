import { setComponentTemplate } from "@glimmer/manager";
import { templateFactory as createTemplateFactory } from "@glimmer/opcode-compiler";
import { templateOnlyComponent as templateOnly } from "@glimmer/runtime";
const X = 1;
const y = 2;
export default setComponentTemplate(createTemplateFactory(
/*
  Hi {{X}} {{y}}
*/
{
  "id": null,
  "block": "[[[1,\"Hi \"],[1,[32,0]],[1,\" \"],[1,[32,1]]],[],false,[]]",
  "moduleName": "(unknown template module)",
  "scope": () => [X, y],
  "isStrictMode": true
}), templateOnly());
