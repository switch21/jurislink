'use client'

import { useSyncExternalStore } from 'react'
import AppClient from './AppClient'

const emptySubscribe = () => () => {}

export default function Page() {
  // useSyncExternalStore with different server/client snapshots is the
  // React 18+ recommended way to detect client-side mount without
  // triggering hydration mismatches.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,  // client snapshot
    () => false, // server snapshot
  )

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-4 border-[#1E5A8A] border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Chargement de JurisLink...</p>
        </div>
      </div>
    )
  }

  return <AppClient />
}
