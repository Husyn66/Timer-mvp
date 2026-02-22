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
  const [status, setStatus] = useState<string>('Loading...')
  const [loading, setLoading] = useState(false)

  const fetchPosts = async () => {
    setLoading(true)
    setStatus('Fetching posts...')

    const { data, error } = await supabase
      .from('posts')
      .select('id,user_id,content,created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      setStatus(`Fetch error: ${error.message}`)
      setPosts([])
      setLoading(false)
      return
    }

    setPosts((data ?? []) as PostRow[])
    setStatus('OK')
    setLoading(false)
  }

  const init = async () => {
    setStatus('Getting user...')
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      setStatus(`Auth error: ${error.message}`)
      return
    }

    const uid = data.user?.id
    if (!uid) {
      setStatus('No user (not logged in)')
      return
    }

    setUserId(uid)
    await fetchPosts()
  }

  const createPost = async () => {
    if (!userId) {
      setStatus('No user (login first)')
      return
    }
    if (!content.trim()) {
      setStatus('Content is empty')
      return
    }

    setLoading(true)
    setStatus('Creating...')

    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      content: content.trim(),
    })

    if (error) {
      setStatus(`Insert error: ${error.message}`)
      setLoading(false)
      return
    }

    setStatus('Post created ✅')
    await fetchPosts() // ← ВОТ ТВОЙ FETCH ПОСЛЕ CREATE
    setLoading(false)
  }

  useEffect(() => {
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Test Post</h1>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>User: {userId || '-'}</div>
        <div style={{ marginTop: 6 }}>Status: {status}</div>
      </div>

      <hr style={{ margin: '16px 0' }} />

      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Create Post</h2>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write something..."
          style={{
            flex: 1,
            padding: 10,
            border: '1px solid #333',
            borderRadius: 10,
            background: 'transparent',
          }}
        />

        <button
          onClick={createPost}
          disabled={loading}
          style={{
            padding: '10px 14px',
            border: '1px solid #333',
            borderRadius: 10,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Create
        </button>

        <button
          onClick={fetchPosts}
          disabled={loading}
          style={{
            padding: '10px 14px',
            border: '1px solid #333',
            borderRadius: 10,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 18 }}>
        Latest posts (top 10)
      </h2>

      {posts.length === 0 ? (
        <div style={{ marginTop: 8, opacity: 0.8 }}>No posts returned.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {posts.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #333',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 700 }}>{p.id}</div>
              <div style={{ marginTop: 6 }}>
                <b>user_id:</b> {p.user_id}
              </div>
              <div style={{ marginTop: 6 }}>{p.content}</div>
              <div style={{ marginTop: 6, opacity: 0.8 }}>
                {new Date(p.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}