'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import PostLikeButton from './posts/PostLikeButton'
import PostComments from './posts/PostComments'

type FeedPost = {
  id: string
  content: string | null
  image_url: string | null
  created_at: string
  user_id: string
  username: string | null
  like_count: number | null
  comment_count: number | null
  watch_seconds_sum?: number | null
  watchers_count?: number | null
  completion_users?: number | null
  score?: number | null
  follower_id?: string | null
}

type FeedMode = 'for_you' | 'latest' | 'following'

const PAGE_SIZE = 10
const FEED_MODE_KEY = 'timer_feed_mode'

export default function FeedPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [posts, setPosts] = useState<FeedPost[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [modeReady, setModeReady] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const isFetchingRef = useRef(false)

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

  const imageStyle: CSSProperties = {
    width: '100%',
    maxHeight: 420,
    objectFit: 'cover',
    borderRadius: 12,
    border: '1px solid #444',
    marginTop: 12,
  }

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 999,
    border: active ? '1px solid #111' : '1px solid #555',
    background: active ? '#111' : '#eee',
    color: active ? '#fff' : '#111',
    cursor: 'pointer',
    fontWeight: 700,
  })

  const commentToggleStyle: CSSProperties = {
    marginTop: 10,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #444',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 13,
  }

  const usernameLinkStyle: CSSProperties = {
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
  }

  const deleteBtnStyle: CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #aa4444',
    background: '#fff5f5',
    color: '#991b1b',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
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

  const fetchFeedBatch = useCallback(
    async (uid: string, from: number, to: number) => {
      if (feedMode === 'for_you') {
        const { data, error } = await supabase
          .from('feed_ranked')
          .select(
            'id, content, image_url, created_at, user_id, username, like_count, comment_count, watch_seconds_sum, watchers_count, completion_users, score'
          )
          .order('score', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, to)

        if (error) throw new Error(`Failed to load For You feed: ${error.message}`)
        return (data ?? []) as FeedPost[]
      }

      if (feedMode === 'following') {
        const { data, error } = await supabase
          .from('feed_following')
          .select(
            'follower_id, id, user_id, content, created_at, username, image_url, like_count, comment_count'
          )
          .eq('follower_id', uid)
          .order('created_at', { ascending: false })
          .range(from, to)

        if (error) throw new Error(`Failed to load Following feed: ${error.message}`)
        return (data ?? []) as FeedPost[]
      }

      const { data, error } = await supabase
        .from('feed_posts')
        .select(
          'id, user_id, content, created_at, username, comment_count, image_url, like_count'
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw new Error(`Failed to load Latest feed: ${error.message}`)
      return (data ?? []) as FeedPost[]
    },
    [feedMode, supabase]
  )

  const loadLikedState = useCallback(
    async (uid: string, visiblePosts: FeedPost[]) => {
      if (visiblePosts.length === 0) {
        if (mountedRef.current) setLikedPostIds(new Set())
        return
      }

      const postIds = visiblePosts.map((p) => p.id)

      const { data, error } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', uid)
        .in('post_id', postIds)

      if (error) throw new Error(`Failed to load like state: ${error.message}`)

      const likedIds = new Set<string>((data ?? []).map((row: any) => row.post_id))

      if (mountedRef.current) {
        setLikedPostIds(likedIds)
      }
    },
    [supabase]
  )

  const loadInitial = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setLoading(true)
    setError('')
    setHasMore(true)

    try {
      const uid = await loadCurrentUser()
      if (!uid) return

      const batch = await fetchFeedBatch(uid, 0, PAGE_SIZE - 1)

      if (!mountedRef.current) return

      setPosts(batch)
      setHasMore(batch.length === PAGE_SIZE)
      await loadLikedState(uid, batch)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      if (mountedRef.current) setError(msg)
    } finally {
      if (mountedRef.current) setLoading(false)
      isFetchingRef.current = false
    }
  }, [fetchFeedBatch, loadCurrentUser, loadLikedState])

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current) return
    if (!hasMore) return
    if (!currentUserId) return

    isFetchingRef.current = true
    setLoadingMore(true)
    setError('')

    try {
      const from = posts.length
      const to = from + PAGE_SIZE - 1

      const batch = await fetchFeedBatch(currentUserId, from, to)

      if (!mountedRef.current) return

      if (batch.length === 0) {
        setHasMore(false)
        return
      }

      let mergedPosts: FeedPost[] = []

      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        const merged = [...prev]

        for (const item of batch) {
          if (!seen.has(item.id)) merged.push(item)
        }

        mergedPosts = merged
        return merged
      })

      if (mergedPosts.length > 0) {
        await loadLikedState(currentUserId, mergedPosts)
      }

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
  }, [currentUserId, fetchFeedBatch, hasMore, loadLikedState, posts.length])

  const handleReload = useCallback(async () => {
    setPosts([])
    setLikedPostIds(new Set())
    setHasMore(true)
    setError('')
    await loadInitial()
  }, [loadInitial])

  const applyLikeDelta = useCallback((postId: string, nextLiked: boolean) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post

        const current = post.like_count ?? 0
        const nextCount = nextLiked ? current + 1 : Math.max(current - 1, 0)

        return {
          ...post,
          like_count: nextCount,
        }
      })
    )

    setLikedPostIds((prev) => {
      const next = new Set(prev)
      if (nextLiked) next.add(postId)
      else next.delete(postId)
      return next
    })
  }, [])

  const applyCommentDelta = useCallback((postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post

        const current = post.comment_count ?? 0
        return {
          ...post,
          comment_count: Math.max(current + delta, 0),
        }
      })
    )
  }, [])

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (!currentUserId) return

      const confirmed = window.confirm('Delete this post? This action cannot be undone.')
      if (!confirmed) return

      setDeletingPostId(postId)
      setError('')

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', currentUserId)

      if (error) {
        setError(`Failed to delete post: ${error.message}`)
        setDeletingPostId(null)
        return
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId))
      setLikedPostIds((prev) => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      setDeletingPostId(null)
    },
    [currentUserId, supabase]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const savedMode = window.localStorage.getItem(FEED_MODE_KEY)

    if (savedMode === 'for_you' || savedMode === 'latest' || savedMode === 'following') {
      setFeedMode(savedMode)
    }

    setModeReady(true)
  }, [])

  useEffect(() => {
    if (!modeReady) return
    window.localStorage.setItem(FEED_MODE_KEY, feedMode)
  }, [feedMode, modeReady])

  useEffect(() => {
    if (!modeReady) return

    setPosts([])
    setLikedPostIds(new Set())
    setHasMore(true)
    setError('')
    void loadInitial()
  }, [feedMode, modeReady, loadInitial])

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

  const renderPostBody = (post: FeedPost, idx: number): ReactNode => {
    const likeCount = post.like_count ?? 0
    const commentCount = post.comment_count ?? 0

    const rawUsername = post.username ?? 'unknown'
    const authorLabel = feedMode === 'for_you' ? `#${idx + 1}` : null
    const isOwnPost = currentUserId === post.user_id
    const isDeletingThisPost = deletingPostId === post.id

    return (
      <article
        key={post.id}
        style={{
          border: '1px solid #444',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {authorLabel && <span style={{ fontWeight: 700 }}>{authorLabel} ·</span>}
              <span
                style={usernameLinkStyle}
                onClick={() => router.push(`/profile/${encodeURIComponent(rawUsername)}`)}
              >
                {rawUsername}
              </span>
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {new Date(post.created_at).toLocaleString()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {isOwnPost && (
              <button
                onClick={() => void handleDeletePost(post.id)}
                style={deleteBtnStyle}
                disabled={isDeletingThisPost}
              >
                {isDeletingThisPost ? 'Deleting...' : 'Delete post'}
              </button>
            )}

            <PostLikeButton
              postId={post.id}
              postOwnerId={post.user_id}
              currentUserId={currentUserId}
              initialLiked={likedPostIds.has(post.id)}
              initialCount={likeCount}
              onToggle={applyLikeDelta}
            />
          </div>
        </div>

        {post.content && (
          <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
            {post.content}
          </div>
        )}

        {post.image_url && <img src={post.image_url} alt="Post image" style={imageStyle} />}

        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={pill}>❤️ {likeCount}</span>
          <span style={pill}>💬 {commentCount}</span>
        </div>

        <PostComments
          postId={post.id}
          postOwnerId={post.user_id}
          currentUserId={currentUserId}
          initialCount={commentCount}
          onCommentAdded={() => applyCommentDelta(post.id, 1)}
          toggleStyle={commentToggleStyle}
        />
      </article>
    )
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          Feed (
          {feedMode === 'for_you'
            ? 'For You'
            : feedMode === 'latest'
              ? 'Latest'
              : 'Following'}
          )
        </h1>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => void handleReload()} style={btnStyle}>
            Reload
          </button>
          <button onClick={() => router.push('/notifications')} style={btnStyle}>
            Notifications
          </button>
          <button onClick={() => router.push('/')} style={btnStyle}>
            ← Home
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFeedMode('for_you')}
          style={tabStyle(feedMode === 'for_you')}
        >
          For You
        </button>

        <button
          onClick={() => setFeedMode('latest')}
          style={tabStyle(feedMode === 'latest')}
        >
          Latest
        </button>

        <button
          onClick={() => setFeedMode('following')}
          style={tabStyle(feedMode === 'following')}
        >
          Following
        </button>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && error && (
        <div style={{ padding: 12, border: '1px solid #f00', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Error</p>
          <p style={{ marginTop: 6 }}>{error}</p>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <p>
          {feedMode === 'following'
            ? 'No posts from followed users yet.'
            : 'No posts yet.'}
        </p>
      )}

      {!loading && !error && posts.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {posts.map((post, idx) => (
            <div key={post.id}>{renderPostBody(post, idx)}</div>
          ))}

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