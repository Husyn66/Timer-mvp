'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PostRow = {
  id: string
  user_id: string
  content: string | null
  created_at: string
}

export default function Page() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const loadPosts = async () => {
    setError('')

    const res = await (supabase as any)
      .from('posts')
      .select('id, user_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    const data = res?.data ?? null
    const err = res?.error ?? null

    if (err) {
      setError(err.message ?? 'Failed to load posts')
      setPosts([])
      return
    }

    setPosts((data ?? []) as PostRow[])
  }

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      setLoading(true)
      setError('')

      try {
        const { data: authRes, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr

        const uid = authRes.user?.id ?? null

        console.log('[HOME] ORIGIN:', window.location.origin)
        console.log('[HOME] USER:', uid)

        if (!uid) {
          router.replace('/login')
          return
        }

        if (!cancelled) setCurrentUserId(uid)

        await loadPosts()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const createPost = async () => {
    const trimmed = content.trim()
    if (!trimmed) return

    if (!currentUserId) {
      setError('You must be logged in.')
      return
    }

    setSending(true)
    setError('')

    const res = await (supabase as any).from('posts').insert({
      user_id: currentUserId,
      content: trimmed,
    })

    const err = res?.error ?? null

    if (err) {
      setError(err.message ?? 'Failed to create post')
      setSending(false)
      return
    }

    setContent('')
    setSending(false)
    await loadPosts()
  }

  const btnStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #555',
    background: '#eee',
    color: '#111',
    cursor: 'pointer',
    fontWeight: 700,
  }

  const btnDisabledStyle: React.CSSProperties = {
    ...btnStyle,
    opacity: 0.6,
    cursor: 'not-allowed',
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Home</h1>
        <p>Loading…</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Home</h1>

        <button onClick={() => router.push('/feed')} style={btnStyle}>
          Go to Feed →
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, border: '1px solid #f00', borderRadius: 8, marginBottom: 12 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Error</p>
          <p style={{ marginTop: 6 }}>{error}</p>
        </div>
      )}

      <section style={{ border: '1px solid #444', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Create post</div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write something…"
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: 10,
            borderRadius: 10,
            border: '1px solid #444',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
          }}
          maxLength={2000}
          disabled={sending}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            user: {currentUserId ? currentUserId.slice(0, 8) + '…' : 'null'}
          </div>

          <button
            onClick={createPost}
            disabled={sending || content.trim().length === 0}
            style={sending || content.trim().length === 0 ? btnDisabledStyle : btnStyle}
          >
            {sending ? 'Sending…' : 'Post'}
          </button>
        </div>
      </section>

      <section>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Latest posts</div>

        {posts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {posts.map((p) => (
              <article key={p.id} style={{ border: '1px solid #444', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(p.created_at).toLocaleString()} • {p.user_id.slice(0, 8)}…
                </div>
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{p.content ?? ''}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}