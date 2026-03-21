'use client'

import { createClient } from '@/lib/supabase/client'
import { useRef, useState } from 'react'
import Link from 'next/link'

export default function SignupPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [signupComplete, setSignupComplete] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (loading) return

    setError('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Email is required.')
      return
    }

    if (!password) {
      setError('Password is required.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSignupComplete(true)
    setPassword('')
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Sign up
      </h1>

      {signupComplete ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ color: '#16a34a' }}>
            If this email is new, a confirmation link has been sent. Open it before logging in.
          </p>
          <p style={{ color: '#666' }}>
            After confirmation, go to the login page.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #333',
              textDecoration: 'none',
              color: 'inherit',
              textAlign: 'center',
            }}
          >
            Go to login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #333' }}
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #333' }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #333' }}
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>

          {error ? <p style={{ color: 'tomato' }}>{error}</p> : null}
        </form>
      )}
    </main>
  )
}