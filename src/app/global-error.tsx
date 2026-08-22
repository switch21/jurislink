'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body className="bg-[#F9FAFB]">
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
            <div className="size-12 rounded-full bg-rose-100 flex items-center justify-center">
              <span className="text-rose-600 text-xl font-bold">!</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Une erreur est survenue</p>
            <p className="text-xs text-gray-500">{error?.message || 'Erreur inconnue'}</p>
            <button
              onClick={reset}
              className="px-5 py-2 bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
