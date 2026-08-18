// ============================================================================
// JurisLink - Phase 1.4 - Setup Vitest (matcher jest-dom + polyfills)
// ============================================================================
// Emplacement: src/__tests__/setup.ts
// ============================================================================

import '@testing-library/jest-dom/vitest'
import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Nettoyage DOM entre les tests
afterEach(() => {
  cleanup()
})

// Mock i18next (les tests ne chargent pas les fichiers de locale)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: {
      changeLanguage: vi.fn(),
      language: 'fr',
    },
  }),
  initReactI18next: { type: '3rd-party', init: vi.fn() },
}))

// Mock matchMedia (requis par certaines libs UI)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

// Mock IntersectionObserver
class MockIntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

// Mock URL.createObjectURL (requis pour les tests de file upload)
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'mocked-url'),
})

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
})
