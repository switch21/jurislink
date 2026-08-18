// ============================================================================
// JurisLink - Phase 1.4 - Configuration Vitest
// ============================================================================
// Remplace/ajoute: vitest.config.ts (à la racine du projet)
//
// Prérequis (ajouter à package.json):
//   "devDependencies": {
//     "vitest": "^2.1.8",
//     "@testing-library/react": "^16.0.1",
//     "@testing-library/jest-dom": "^6.6.3",
//     "@testing-library/user-event": "^14.5.2",
//     "jsdom": "^25.0.1",
//     "@vitest/coverage-v8": "^2.1.8"
//   }
//
// Commandes package.json à ajouter:
//   "scripts": {
//     "test": "vitest run",
//     "test:watch": "vitest",
//     "test:coverage": "vitest run --coverage"
//   }
// ============================================================================

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/pages/**/*.tsx',
        'src/components/**/*.tsx',
        'src/store/**/*.ts',
        'src/lib/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/main.tsx',
      ],
      thresholds: {
        // Seuils initiaux bas — augmenter progressivement
        statements: 15,
        branches: 15,
        functions: 15,
        lines: 15,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
