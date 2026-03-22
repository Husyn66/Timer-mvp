'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchWithRetry } from '@/lib/fetchWithRetry'

import PostLikeButton from './posts/PostLikeButton'
import PostComments from './posts/PostComments'
import PostWatchTracker from './posts/PostWatchTracker'
import RetryBlock from '../components/RetryBlock'
import XPProgressWrapper from '../components/XPProgressWrapper'

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
  const [retrying, setRetrying] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [modeReady, setModeReady] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const isFetchingRef = useRef(false)
  const postsRef = useRef<FeedPost[]>([])
  const serverOffsetRef = useRef(0)

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

  const shouldRetryFeedError = useCallback((error: unknown) => {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

    return (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('temporary') ||
      message.includes('fetch')
    )
  }, [])

  const resetFeedState = useCallback(() => {
    postsRef.current = []
    serverOffsetRef.current = 0
    setPosts([])
    setLikedPostIds(new Set())
    setHasMore(true)
    setError('')
  }, [])

  const loadCurrentUser = useCallback(async () => {
    const { data: authRes, error: authErr } = await supabase.auth.getUser()
    if (authErr) throw authErr

    const uid = authRes.user?.id ?? null
    if (!uid) {
      router.replace('/login')
      return null
    }

    if (mountedRef.current) {
      setCurrentUserId(uid)
    }

    return uid
  }, [router, supabase])

  const fetchFeedBatch = useCallback(
    async (uid: string, from: number, to: number) => {
      return fetchWithRetry(
        async () => {
          if (feedMode === 'for_you') {
            const { data, error } = await supabase
              .from('feed_ranked')
              .select(
                'id, content, image_url, created_at, user_id, username, like_count, comment_count, watch_seconds_sum, watchers_count, completion_users, score'
              )
              .order('score', { ascending: false })
              .order('created_at', { ascending: false })
              .range(from, to)

            if (error) {
              throw new Error(`Failed to load For You feed: ${error.message}`)
            }

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

            if (error) {
              throw new Error(`Failed to load Following feed: ${error.message}`)
            }

            return (data ?? []) as FeedPost[]
          }

          const { data, error } = await supabase
            .from('feed_posts')
            .select(
              'id, user_id, content, created_at, username, comment_count, image_url, like_count'
            )
            .order('created_at', { ascending: false })
            .range(from, to)

          if (error) {
            throw new Error(`Failed to load Latest feed: ${error.message}`)
          }

          return (data ?? []) as FeedPost[]
        },
        {
          retries: 2,
          delayMs: 900,
          shouldRetry: shouldRetryFeedError,
        }
      )
    },
    [feedMode, shouldRetryFeedError, supabase]
  )

  const loadLikedState = useCallback(
    async (uid: string, visiblePosts: FeedPost[], mode: 'replace' | 'merge' = 'replace') => {
      if (visiblePosts.length === 0) {
        if (mode === 'replace' && mountedRef.current) {
          setLikedPostIds(new Set())
        }
        return
      }

      const postIds = visiblePosts.map((p) => p.id)

      const likedIds = await fetchWithRetry(
        async () => {
          const { data, error } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', uid)
            .in('post_id', postIds)

          if (error) {
            throw new Error(`Failed to load like state: ${error.message}`)
          }

          return new Set<string>((data ?? []).map((row: { post_id: string }) => row.post_id))
        },
        {
          retries: 1,
          delayMs: 700,
          shouldRetry: shouldRetryFeedError,
        }
      )

      if (!mountedRef.current) return

      if (mode === 'replace') {
        setLikedPostIds(likedIds)
        return
      }

      setLikedPostIds((prev) => {
        const next = new Set(prev)
        for (const id of likedIds) {
          next.add(id)
        }
        return next
      })
    },
    [shouldRetryFeedError, supabase]
  )

  const loadInitial = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setLoading(true)
    setError('')

    try {
      const uid = await loadCurrentUser()
      if (!uid) return

      const batch = await fetchFeedBatch(uid, 0, PAGE_SIZE - 1)

      if (!mountedRef.current) return

      postsRef.current = batch
      serverOffsetRef.current = batch.length

      setPosts(batch)
      setHasMore(batch.length === PAGE_SIZE)

      await loadLikedState(uid, batch, 'replace')
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
      const from = serverOffsetRef.current
      const to = from + PAGE_SIZE - 1

      const batch = await fetchFeedBatch(currentUserId, from, to)

      if (!mountedRef.current) return

      if (batch.length === 0) {
        setHasMore(false)
        return
      }

      const currentPosts = postsRef.current
      const seen = new Set(currentPosts.map((p) => p.id))
      const uniqueNewPosts = batch.filter((item) => !seen.has(item.id))
      const merged = [...currentPosts, ...uniqueNewPosts]

      postsRef.current = merged
      serverOffsetRef.current = from + batch.length

      setPosts(merged)

      if (uniqueNewPosts.length > 0) {
        await loadLikedState(currentUserId, uniqueNewPosts, 'merge')
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
  }, [currentUserId, fetchFeedBatch, hasMore, loadLikedState])

  const handleReload = useCallback(async () => {
    try {
      setRetrying(true)
      isFetchingRef.current = false
      resetFeedState()
      await loadInitial()
    } finally {
      setRetrying(false)
    }
  }, [loadInitial, resetFeedState])

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

    postsRef.current = postsRef.current.map((post) => {
      if (post.id !== postId) return post

      const current = post.like_count ?? 0
      const nextCount = nextLiked ? current + 1 : Math.max(current - 1, 0)

      return {
        ...post,
        like_count: nextCount,
      }
    })

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

    postsRef.current = postsRef.current.map((post) => {
      if (post.id !== postId) return post

      const current = post.comment_count ?? 0
      return {
        ...post,
        comment_count: Math.max(current + delta, 0),
      }
    })
  }, [])

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (!currentUserId) return

      const confirmed = window.confirm('Delete this post? This action cannot be undone.')
      if (!confirmed) return

      setDeletingPostId(postId)
      setError('')

      try {
        await fetchWithRetry(
          async () => {
            const { error } = await supabase
              .from('posts')
              .delete()
              .eq('id', postId)
              .eq('user_id', currentUserId)

            if (error) {
              throw new Error(`Failed to delete post: ${error.message}`)
            }
          },
          {
            retries: 1,
            delayMs: 700,
            shouldRetry: shouldRetryFeedError,
          }
        )

        const nextPosts = postsRef.current.filter((post) => post.id !== postId)
        postsRef.current = nextPosts
        setPosts(nextPosts)

        setLikedPostIds((prev) => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
      } finally {
        setDeletingPostId(null)
      }
    },
    [currentUserId, shouldRetryFeedError, supabase]
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

    resetFeedState()
    void loadInitial()
  }, [feedMode, modeReady, loadInitial, resetFeedState])

  useEffect(() => {
    if (!sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !loading && !loadingMore && !error) {
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
  }, [error, hasMore, loading, loadingMore, loadMore])

  const renderPostBody = (post: FeedPost, idx: number): ReactNode => {
    const likeCount = post.like_count ?? 0
    const commentCount = post.comment_count ?? 0

    const rawUsername = post.username ?? 'unknown'
    const authorLabel = feedMode === 'for_you' ? `#${idx + 1}` : null
    const isOwnPost = currentUserId === post.user_id
    const isDeletingThisPost = deletingPostId === post.id

    return (
      <article
        style={{
          border: '1px solid #444',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <PostWatchTracker postId={post.id} enabled={!!currentUserId} />

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

        {post.content && <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{post.content}</div>}

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
          <button
            onClick={() => void handleReload()}
            style={btnStyle}
            disabled={loading || loadingMore || retrying}
          >
            {retrying ? 'Retrying...' : 'Reload'}
          </button>
          <button onClick={() => router.push('/notifications')} style={btnStyle}>
            Notifications
          </button>
          <button onClick={() => router.push('/')} style={btnStyle}>
            ← Home
          </button>
        </div>
      </div>

      {currentUserId && <XPProgressWrapper userId={currentUserId} />}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFeedMode('for_you')}
          style={tabStyle(feedMode === 'for_you')}
          disabled={loading || loadingMore}
        >
          For You
        </button>

        <button
          onClick={() => setFeedMode('latest')}
          style={tabStyle(feedMode === 'latest')}
          disabled={loading || loadingMore}
        >
          Latest
        </button>

        <button
          onClick={() => setFeedMode('following')}
          style={tabStyle(feedMode === 'following')}
          disabled={loading || loadingMore}
        >
          Following
        </button>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && error && (
        <RetryBlock
          title="Feed is temporarily unavailable"
          description={error}
          onRetry={() => void handleReload()}
          isRetrying={retrying}
        />
      )}

      {!loading && !error && posts.length === 0 && (
        <p>{feedMode === 'following' ? 'No posts from followed users yet.' : 'No posts yet.'}</p>
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