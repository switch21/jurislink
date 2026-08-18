// ============================================================================
// JurisLink - Phase 5.9 - Patch vite.config.ts (security headers dev/preview)
// ============================================================================
// Remplace: vite.config.ts
//
// Changements vs version actuelle:
//   1. Ajout de server.headers (dev server) — pas de HSTS car HTTP en dev.
//   2. Ajout de preview.headers (preview build local) — HSTS + CSP complet.
//   3. CSP construit dynamiquement à partir de VITE_SUPABASE_URL pour
//      autoriser le bon connect-src.
// ============================================================================

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { buildCsp, buildSecurityHeaders } from './src/lib/securityHeaders'

export default defineConfig(({ mode }) => {
  // Charge les variables d'env (.env, .env.development, .env.production)
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = env.VITE_SUPABASE_URL ?? ''
  const isDev = mode === 'development'

  // CSP adapté selon le mode (dev autorise ws://localhost pour HMR)
  const csp = buildCsp({
    supabaseUrl,
    devMode: isDev,
  })

  // En-têtes de sécurité de base (hors CSP)
  const securityHeaders = buildSecurityHeaders({ hsts: !isDev })

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'JurisLink Operational Platform',
          short_name: 'JurisLink',
          description: 'Plateforme opérationnelle de gestion juridique pour cabinets d\'avocats.',
          theme_color: '#0f172a',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
          ],
          display: 'standalone',
          background_color: '#0f172a'
        }
      })
    ],
    server: {
      // Dev server: HTTP (pas de HSTS), CSP adapté pour HMR WebSocket
      headers: {
        ...securityHeaders,
        'Content-Security-Policy': csp,
      },
    },
    preview: {
      // Preview (vite preview — pour tester le build local): HTTPS-ready
      headers: {
        ...securityHeaders,
        'Content-Security-Policy': csp,
      },
    },
  }
})
