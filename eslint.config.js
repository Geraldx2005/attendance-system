import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],

    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],

    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },

    rules: {
      // Completely turn off unused variable warnings
      'no-unused-vars': 'off',

      // Turn off unused arguments warnings
      'no-unused-labels': 'off',

      // Suppress React hook dependency nags
      'react-hooks/exhaustive-deps': 'off',

      // Other chill settings
      'no-console': 'off',
      'no-undef': 'off',
      'no-extra-boolean-cast': 'off',
      'no-case-declarations': 'off',
      'no-prototype-builtins': 'off',

      // Disable Fast Refresh's "export components only" rule
      'react-refresh/only-export-components': 'off',
    },
  },
])
