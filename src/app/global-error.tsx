'use client'

import { useEffect } from 'react'

/**
 * Global error boundary — catches errors that error.tsx doesn't catch.
 * This includes errors in the root layout itself.
 * Renders a complete HTML document (required for global-error.tsx).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.warn('[JurisLink] Global error recovery:', error.message)
  }, [error])

  useEffect(() => {
    const timer = setTimeout(reset, 0)
    return () => clearTimeout(timer)
  }, [reset])

  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
          <div className="flex flex-col items-center gap-3">
            <div className="size-10 rounded-full border-4 border-[#1E5A8A] border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500">Chargement de JurisLink...</p>
          </div>
        </div>
      </body>
    </html>
  )
}
