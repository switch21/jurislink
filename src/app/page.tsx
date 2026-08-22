'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const AppClient = dynamic(() => import('./AppClient'), { ssr: false })

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 rounded-full border-4 border-[#1E5A8A] border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">Chargement de JurisLink...</p>
      </div>
    </div>
  )
}

export default function Page() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  // Server and client both render Spinner during hydration (ready=false)
  // AppClient is only rendered AFTER hydration via useEffect state change
  if (!ready) return <Spinner />

  return <AppClient />
}
