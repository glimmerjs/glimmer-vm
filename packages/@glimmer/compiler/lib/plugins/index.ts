import { ASTPluginBuilder } from '@glimmer/syntax';
import NamedBlocks from './named-blocks';

const PLUGINS: ASTPluginBuilder[] = [NamedBlocks];

export default PLUGINS;
