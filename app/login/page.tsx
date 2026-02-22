'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient() // ✅ ВОТ ЭТОГО НЕ ХВАТАЛО

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Email</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Password</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="your password"
              autoComplete="current-password"
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-md border px-3 py-2 font-semibold"
            type="submit"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {error && (
          <p className="text-sm" style={{ color: 'crimson' }}>
            {error}
          </p>
        )}

        <div className="space-y-2">
          <button
            className="w-full rounded-md border px-3 py-2"
            onClick={() => router.push('/signup')}
            type="button"
          >
            Create account
          </button>

          <button
            className="w-full rounded-md border px-3 py-2"
            onClick={() => router.push('/')}
            type="button"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  )
}