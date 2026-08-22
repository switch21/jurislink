'use client'

import dynamic from 'next/dynamic'

const AppClient = dynamic(() => import('./AppClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 rounded-full border-4 border-[#1E5A8A] border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">Chargement de JurisLink...</p>
      </div>
    </div>
  ),
})

export default function Page() {
  return <AppClient />
}
