'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PostRow = {
  id: string
  user_id: string
  content: string
  created_at: string
}

export default function TestPostPage() {
  const supabase = createClient()

  const [userId, setUserId] = useState<string>('')
  const [content, setContent] = useState('Hello from test-post')
  const [posts, setPosts] = useState<PostRow[]>([])
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function loadUserAndPosts() {
    setStatus('Loading...')
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr) {
      setStatus(`Auth error: ${authErr.message}`)
      return
    }
    const id = authData?.user?.id
    if (!id) {
      setStatus('Auth session missing')
      return
    }
    setUserId(id)

    const { data, error } = await supabase
      .from('posts')
      .select('id,user_id,content,created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      setStatus(`Fetch error: ${error.message}`)
      return
    }

    setPosts((data ?? []) as PostRow[])
    setStatus('OK')
  }

  async function createPost() {
    if (!userId) {
      setStatus('No userId (session missing)')
      return
    }

    setLoading(true)
    setStatus('Creating...')

    const { error } = await supabase.from('posts').insert({
      user_id: userId,     // важно: у тебя колонка называется user_id (не author_id)
      content: content,
    })

    if (error) {
      setStatus(`Insert error: ${error.message}`)
      setLoading(false)
      return
    }

    setStatus('Post created ✅')
    await loadUserAndPosts() // <-- вот тот самый fetch после Create
    setLoading(false)
  }

  useEffect(() => {
    loadUserAndPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Test Post</h1>

      <div style={{ marginTop: 12 }}>
        <div><b>User:</b> {userId || '(none)'}</div>
        <div><b>Status:</b> {status}</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Create Post</h3>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 10 }}
        />
        <button onClick={createPost} disabled={loading} style={{ marginRight: 10 }}>
          {loading ? 'Creating...' : 'Create'}
        </button>
        <button onClick={loadUserAndPosts} disabled={loading}>
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Latest posts (top 10)</h3>
        {posts.length === 0 ? (
          <div>No posts returned.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map((p) => (
              <div key={p.id} style={{ border: '1px solid #333', padding: 12, borderRadius: 8 }}>
                <div><b>{p.id}</b></div>
                <div>user_id: {p.user_id}</div>
                <div>{p.content}</div>
                <div style={{ opacity: 0.8 }}>{new Date(p.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}