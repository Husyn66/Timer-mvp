'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function TestPostPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        setMessage(`Auth error: ${error.message}`)
        return
      }
      setUserId(data.user?.id ?? null)
    }
    load()
  }, [supabase])

  const createPost = async () => {
    if (!userId) {
      setMessage('No user. Please login first.')
      return
    }

    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      content: 'My first post 🚀',
    })

    setMessage(error ? `Insert error: ${error.message}` : 'Post created ✅')
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Test Post</h1>
      <p>User: {userId ?? 'not logged in'}</p>

      <button onClick={createPost} style={{ padding: '10px 14px' }}>
        Create Post
      </button>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </main>
  )
}
