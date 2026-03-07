'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import PostWatchTracker from './posts/PostWatchTracker'
import PostLikeButton from './posts/PostLikeButton'
import PostComments from './posts/PostComments'

type RankedPost = {
  id: string
  content: string | null
  created_at: string
  user_id: string
  username: string | null
  like_count: number | null
  comment_count: number | null
  watch_seconds_sum: number | null
  watchers_count: number | null
  completion_users: number | null
  score: number | null
}

export default function FeedPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [posts, setPosts] = useState<RankedPost[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')

  const mountedRef = useRef(true)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const isFetchingRef = useRef(false)

  const PAGE_SIZE = 10

  const btnStyle: CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #555',
    background: '#eee',
    color: '#111',
    cursor: 'pointer',
    fontWeight: 700,
  }

  const pill: CSSProperties = {
    display: 'inline-flex',
    gap: 8,
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid #444',
    fontSize: 12,
    opacity: 0.85,
  }

  const loadCurrentUser = useCallback(async () => {
    const { data: authRes, error: authErr } = await supabase.auth.getUser()
    if (authErr) throw authErr

    const uid = authRes.user?.id ?? null
    if (!uid) {
      router.replace('/login')
      return null
    }

    if (mountedRef.current) setCurrentUserId(uid)
    return uid
  }, [router, supabase])

  const loadInitial = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setLoading(true)
    setError('')
    setHasMore(true)

    try {
      const uid = await loadCurrentUser()
      if (!uid) return

      const { data, error: feedErr } = await supabase
        .from('feed_ranked')
        .select(
          'id, content, created_at, user_id, username, like_count, comment_count, watch_seconds_sum, watchers_count, completion_users, score'
        )
        .order('score', { ascending: false })
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      if (feedErr) {
        throw new Error(`Failed to load feed_ranked: ${feedErr.message}`)
      }

      const batch = (data ?? []) as RankedPost[]

      if (!mountedRef.current) return

      setPosts(batch)
      setHasMore(batch.length === PAGE_SIZE)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      if (mountedRef.current) setError(msg)
    } finally {
      if (mountedRef.current) setLoading(false)
      isFetchingRef.current = false
    }
  }, [loadCurrentUser, supabase])

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current) return
    if (!hasMore) return

    isFetchingRef.current = true
    setLoadingMore(true)
    setError('')

    try {
      const alreadyLoaded = posts.length
      const from = alreadyLoaded
      const to = alreadyLoaded + PAGE_SIZE - 1

      const { data, error: feedErr } = await supabase
        .from('feed_ranked')
        .select(
          'id, content, created_at, user_id, username, like_count, comment_count, watch_seconds_sum, watchers_count, completion_users, score'
        )
        .order('score', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (feedErr) {
        throw new Error(`Failed to load more feed_ranked: ${feedErr.message}`)
      }

      const batch = (data ?? []) as RankedPost[]

      if (!mountedRef.current) return

      if (batch.length === 0) {
        setHasMore(false)
        return
      }

      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        const merged = [...prev]
        for (const item of batch) {
          if (!seen.has(item.id)) merged.push(item)
        }
        return merged
      })

      if (batch.length < PAGE_SIZE) {
        setHasMore(false)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      if (mountedRef.current) setError(msg)
    } finally {
      if (mountedRef.current) setLoadingMore(false)
      isFetchingRef.current = false
    }
  }, [hasMore, posts.length, supabase])

  useEffect(() => {
    mountedRef.current = true
    void loadInitial()

    return () => {
      mountedRef.current = false
    }
  }, [loadInitial])

  useEffect(() => {
    if (!sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          void loadMore()
        }
      },
      {
        root: null,
        rootMargin: '300px',
        threshold: 0.1,
      }
    )

    observer.observe(sentinelRef.current)

    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadMore])

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Feed (Infinite)</h1>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => void loadInitial()} style={btnStyle}>
            Reload
          </button>
          <button onClick={() => router.push('/')} style={btnStyle}>
            ← Home
          </button>
        </div>
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
          {posts.map((post, idx) => {
            const likeCount = post.like_count ?? 0
            const commentCount = post.comment_count ?? 0
            const watchSum = post.watch_seconds_sum ?? 0
            const watchers = post.watchers_count ?? 0
            const completions = post.completion_users ?? 0
            const score = post.score ?? 0

            return (
              <article
                key={post.id}
                style={{
                  border: '1px solid #444',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <PostWatchTracker postId={post.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>
                        #{idx + 1} · {post.username ?? 'unknown'}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {new Date(post.created_at).toLocaleString()}
                      </div>
                    </div>

                    <PostLikeButton postId={post.id} currentUserId={currentUserId} />
                  </div>

                  <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                    {post.content ?? ''}
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={pill}>❤️ {likeCount}</span>
                    <span style={pill}>💬 {commentCount}</span>
                    <span style={pill}>⏱️ {watchSum}s</span>
                    <span style={pill}>👥 {watchers}</span>
                    <span style={pill}>✅ {completions}</span>
                    <span style={pill}>⭐ {score.toFixed(2)}</span>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <PostComments postId={post.id} currentUserId={currentUserId} />
                  </div>
                </PostWatchTracker>
              </article>
            )
          })}

          <div ref={sentinelRef} style={{ height: 20 }} />

          {loadingMore && (
            <div
              style={{
                padding: 12,
                textAlign: 'center',
                border: '1px solid #444',
                borderRadius: 8,
                opacity: 0.8,
              }}
            >
              Loading more...
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div
              style={{
                padding: 12,
                textAlign: 'center',
                border: '1px solid #444',
                borderRadius: 8,
                opacity: 0.7,
              }}
            >
              End of feed.
            </div>
          )}
        </div>
      )}
    </main>
  )
}