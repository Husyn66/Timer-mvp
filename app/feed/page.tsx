'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type FeedPost = {
  id: string
  content: string | null
  created_at: string
  user_id: string
  username: string | null
  comment_count: number | null
}

function WatchWrapper({ postId, children }: { postId: string; children: React.ReactNode }) {
  const [seconds, setSeconds] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const ref = useRef<HTMLDivElement | null>(null)
  const lastTickRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const storageKey = useMemo(() => `timer:watch:${postId}`, [postId])

  // restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const n = raw ? Number(raw) : 0
      if (Number.isFinite(n) && n >= 0) setSeconds(Math.floor(n))
    } catch {}
  }, [storageKey])

  // intersection observer
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        setIsVisible(e.isIntersecting && e.intersectionRatio >= 0.6)
      },
      { threshold: [0, 0.6, 1] }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  // ticking
  useEffect(() => {
    const canRun = isVisible && document.visibilityState === 'visible'
    if (!canRun) {
      runningRef.current = false
      lastTickRef.current = null
      return
    }

    runningRef.current = true
    lastTickRef.current = performance.now()

    const id = window.setInterval(() => {
      if (!runningRef.current) return
      if (document.visibilityState !== 'visible') return

      const now = performance.now()
      const last = lastTickRef.current ?? now
      const deltaMs = now - last

      // guard against sleep/lag spikes
      if (deltaMs >= 200 && deltaMs <= 2000) {
        const add = deltaMs / 1000
        setSeconds((s) => {
          const next = s + add
          try {
            localStorage.setItem(storageKey, String(Math.floor(next)))
          } catch {}
          return next
        })
      }

      lastTickRef.current = now
    }, 1000)

    return () => window.clearInterval(id)
  }, [isVisible, storageKey])

  return (
    <div ref={ref}>
      {children}
      <div
        style={{
          marginTop: 8,
          padding: 6,
          fontSize: 12,
          border: '1px solid #0f0',
          borderRadius: 8,
          opacity: 0.85,
        }}
      >
        You watched: <strong>{Math.floor(seconds)}</strong>s
      </div>
    </div>
  )
}

export default function FeedPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const { data: authRes, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr

        const uid = authRes.user?.id ?? null
        if (!uid) {
          router.replace('/login')
          return
        }

        const { data, error: feedErr } = await supabase
          .from('feed_posts')
          .select('id, content, created_at, user_id, username, comment_count')
          .order('created_at', { ascending: false })
          .limit(50)

        if (feedErr) {
          throw new Error(`Failed to load feed_posts: ${feedErr.message}`)
        }

        if (!cancelled) setPosts((data ?? []) as FeedPost[])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const btnStyle = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #555',
    background: '#eee',
    color: '#111',
    cursor: 'pointer',
    fontWeight: 700 as const,
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Feed</h1>
        <button onClick={() => router.push('/')} style={btnStyle}>
          ← Home
        </button>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && error && (
        <div style={{ padding: 12, border: '1px solid #f00', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Error</p>
          <p style={{ marginTop: 6 }}>{error}</p>
        </div>
      )}

      {!loading && !error && posts.length === 0 && <p>No posts yet.</p>}

      {!loading && !error && posts.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {posts.map((post) => (
            <article
              key={post.id}
              style={{
                border: '1px solid #444',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <WatchWrapper postId={post.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{post.username ?? 'unknown'}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{post.content ?? ''}</div>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                  Comments: {post.comment_count ?? 0}
                </div>
              </WatchWrapper>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}