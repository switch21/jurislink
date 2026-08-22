'use client'

import { useEffect } from 'react'

/**
 * Error boundary for the / route.
 * 
 * In React 19, hydration mismatches throw actual errors (not just warnings).
 * This error boundary catches the error and forces a full client-side re-render
 * via reset(), which bypasses hydration entirely.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error for debugging but don't show it to the user
    console.warn('[JurisLink] Recovering from render error:', error.message)
  }, [error])

  useEffect(() => {
    // Immediately force a full client-side re-render.
    // This bypasses hydration and does a pure client-side render,
    // which will correctly load and mount AppClient.
    const timer = setTimeout(reset, 0)
    return () => clearTimeout(timer)
  }, [reset])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 rounded-full border-4 border-[#1E5A8A] border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">Chargement de JurisLink...</p>
      </div>
    </div>
  )
}
