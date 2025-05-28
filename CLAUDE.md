# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Building
- `pnpm run build:control` - Build all packages using Rollup
- `pnpm clean` - Clean build artifacts
- `pnpm repo:prepack` - Prepare packages for publishing via Turbo

### Testing
- `pnpm test` - Run all tests
- `ember test --server` - Run tests in watch mode (recommended for development)
- `pnpm test:node` - Run Node.js tests via Turbo
- `pnpm test:smoke` - Run smoke tests
- `pnpm test:browserstack` - Run cross-browser tests
- `pnpm start` - Start Vite dev server for browser testing at http://localhost:7357/tests/

To run a single test or test module, use the browser test interface with `pnpm start` and filter tests using the QUnit UI.

### Linting & Type Checking
- `pnpm test:lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix linting issues and format with Prettier
- `pnpm lint:format` - Check Prettier formatting
- `pnpm repo:lint:types` - Type check all packages via Turbo

### Development
- `pnpm repo:update:metadata` - Update package metadata
- `pnpm repo:update:conventions` - Update conventions across packages

## Architecture

Glimmer VM is a **compiler-based rendering engine** that compiles Handlebars templates into bytecode for efficient execution and updates.

### Core Flow
1. **Templates** (Handlebars) → **Compiler** → **Bytecode** (Wire Format)
2. **Bytecode** → **Runtime VM** → **DOM Operations**
3. **State Changes** → **Validator System** → **Targeted Updates**

### Key Packages

**Compilation Pipeline**:
- `@glimmer/syntax` - Template parser and AST
- `@glimmer/compiler` - Compiles templates to bytecode
- `@glimmer/wire-format` - Bytecode format definitions
- `@glimmer/opcode-compiler` - Bytecode generation

**Runtime Engine**:
- `@glimmer/runtime` - VM that executes bytecode
- `@glimmer/vm` - Core VM implementation
- `@glimmer/reference` - Reactive reference system for state tracking
- `@glimmer/validator` - Change detection and invalidation

**Extension Points**:
- `@glimmer/manager` - Component/helper/modifier manager APIs
- `@glimmer/interfaces` - TypeScript interfaces and contracts

### Monorepo Structure
- Uses pnpm workspaces with Turbo for orchestration
- Packages in `packages/@glimmer/*` are published
- Packages in `packages/@glimmer-workspace/*` are internal tools
- Each package has its own tsconfig with varying strictness levels

### Testing Strategy
- Integration tests in `@glimmer-workspace/integration-tests`
- Unit tests colocated with packages
- Browser tests use QUnit + Testem
- Node tests use Vitest