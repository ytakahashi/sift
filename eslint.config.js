import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { builtinModules } from 'node:module';
import { boundariesConfig } from './eslint.boundaries.js';

// Layers that must stay free of a runtime, expressed as module bans. The local
// dependency edges between layers live in eslint.boundaries.js.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NODE_RUNTIME_MODULE_PATTERN = `^(?:node:.*|${builtinModules
  .map(escapeRegex)
  .join('|')})(?:/.*)?$`;
const NO_NODE_RUNTIME = {
  regex: NODE_RUNTIME_MODULE_PATTERN,
  message: 'This layer must stay free of Node.js APIs; inject them from an infrastructure layer.',
};
const NO_REACT = {
  // Subpaths are listed explicitly so entries such as react/jsx-runtime are
  // covered, not just the package roots.
  group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  message: 'This layer must stay React-independent.',
};
const NO_ELECTRON = {
  group: ['electron', 'electron/*'],
  message: 'This layer must stay free of Electron APIs.',
};
// Pure layers may only reach for relative paths: anything else is an external
// module. Applied to domain/ and to the server's HTTP wire contract.
const PURE_LAYER = {
  regex: '^[^.]',
  message: 'This layer must be pure: no external, Node.js, or browser dependencies.',
};
const PURE_LAYER_TEST = {
  regex: '^(?!vitest$)[^.]',
  message: 'This layer must be pure: the test runner is the only permitted non-relative import.',
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.gemini'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  boundariesConfig,
  {
    // domain/ is pure business logic and server/contract/ is the HTTP wire
    // contract; neither may depend on a framework or a runtime.
    files: ['src/domain/**/*.ts', 'src/server/contract/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [PURE_LAYER] }],
    },
  },
  {
    // Their tests are still pure, but need the test runner itself.
    files: ['src/domain/**/*.test.ts', 'src/server/contract/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [PURE_LAYER_TEST] }],
    },
  },
  {
    files: ['src/client/presentation/**/*.{ts,tsx}', 'src/client/application/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [NO_REACT, NO_NODE_RUNTIME] },
      ],
    },
  },
  {
    files: ['src/server/services/**/*.ts', 'src/server/watch/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_NODE_RUNTIME,
            {
              group: ['chokidar'],
              message:
                'watch/ and services/ define interfaces only; concrete watchers are injected from infrastructure/.',
            },
          ],
        },
      ],
    },
  },
  {
    // entrypoints/shared/ is the contract between sibling entry points, so it
    // must not commit to any one host's runtime. Boundaries only checks local
    // edges, so the runtime bans have to be stated here.
    files: ['src/entrypoints/shared/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [NO_NODE_RUNTIME, NO_REACT, NO_ELECTRON] },
      ],
    },
  },
  {
    // mcp/ is an HTTP client of an already-running server. It shares the server
    // root with utilities it legitimately needs (health probe, port resolver),
    // so boundaries cannot separate them; ban the composition roots by name.
    files: ['src/mcp/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/create-app', '**/server/index'],
              message: 'mcp/ connects to an existing Sift server; it must not build or start one.',
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
