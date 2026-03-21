'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ProfilePost = {
  id: string
  content: string | null
  image_url: string | null
  created_at: string
  user_id: string
  username: string | null
  like_count: number | null
  comment_count: number | null
}

type ProfileIdentityRow = {
  id: string
  username: string | null
  xp_total: number | null
}

const btnStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #555',
  background: '#eee',
  color: '#111',
  cursor: 'pointer',
  fontWeight: 700,
}

const pillStyle: CSSProperties = {
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

const deleteBtnStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #aa4444',
  background: '#fff5f5',
  color: '#991b1b',
  cursor: 'pointer',
  fontWeight: 700,
}

function getLevelFromXp(xp: number): number {
  return Math.floor(xp / 100) + 1
}

function getXpIntoCurrentLevel(xp: number): number {
  return xp % 100
}

export default function ProfilePage() {
  const params = useParams<{ username?: string | string[] }>()
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const followInProgressRef = useRef(false)

  const rawUsernameParam = params?.username
  const rawUsername =
    typeof rawUsernameParam === 'string'
      ? rawUsernameParam.trim()
      : Array.isArray(rawUsernameParam)
        ? (rawUsernameParam[0] ?? '').trim()
        : ''

  const username = rawUsername ? decodeURIComponent(rawUsername) : ''

  const [posts, setPosts] = useState<ProfilePost[]>([])
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [profileExists, setProfileExists] = useState(true)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [profileUsername, setProfileUsername] = useState<string>('')
  const [profileXp, setProfileXp] = useState<number>(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      if (!username) {
        setLoadError('Missing username in route. Open profile by /profile/<username>.')
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')
      setActionError('')
      setProfileExists(true)
      setPosts([])
      setProfileUserId(null)
      setProfileUsername('')
      setProfileXp(0)
      setFollowersCount(0)
      setFollowingCount(0)
      setIsFollowing(false)

      try {
        const {
          data: { user },
          error: authError,
        } = await supabaseRef.current.auth.getUser()

        if (!active) return

        if (authError) {
          setLoadError(authError.message)
          setLoading(false)
          return
        }

        setCurrentUserId(user?.id ?? null)

        const { data: profileRow, error: profileError } = await supabaseRef.current
          .from('profiles')
          .select('id, username, xp_total')
          .eq('username', username)
          .maybeSingle()

        if (!active) return

        if (profileError) {
          setLoadError(profileError.message)
          setLoading(false)
          return
        }

        const typedProfile = (profileRow ?? null) as ProfileIdentityRow | null

        if (!typedProfile) {
          setProfileExists(false)
          setLoading(false)
          return
        }

        const targetUserId = typedProfile.id
        setProfileExists(true)
        setProfileUserId(targetUserId)
        setProfileUsername(typedProfile.username?.trim() || username)
        setProfileXp(Math.max(0, typedProfile.xp_total ?? 0))

        const [
          { data: postRows, error: postsError },
          { count: followers, error: followersError },
          { count: following, error: followingError },
        ] = await Promise.all([
          supabaseRef.current
            .from('feed_posts')
            .select(
              'id, content, image_url, created_at, user_id, username, like_count, comment_count'
            )
            .eq('user_id', targetUserId)
            .order('created_at', { ascending: false }),
          supabaseRef.current
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', targetUserId),
          supabaseRef.current
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', targetUserId),
        ])

        if (!active) return

        if (postsError) {
          setLoadError(postsError.message)
          setLoading(false)
          return
        }

        if (followersError) {
          setLoadError(followersError.message)
          setLoading(false)
          return
        }

        if (followingError) {
          setLoadError(followingError.message)
          setLoading(false)
          return
        }

        setPosts((postRows ?? []) as ProfilePost[])
        setFollowersCount(followers ?? 0)
        setFollowingCount(following ?? 0)

        if (user?.id && user.id !== targetUserId) {
          const { data: followRow, error: followError } = await supabaseRef.current
            .from('follows')
            .select('follower_id, following_id')
            .eq('follower_id', user.id)
            .eq('following_id', targetUserId)
            .maybeSingle()

          if (!active) return

          if (followError) {
            setLoadError(followError.message)
            setLoading(false)
            return
          }

          setIsFollowing(!!followRow)
        } else {
          setIsFollowing(false)
        }

        setLoading(false)
      } catch (e: unknown) {
        if (!active) return
        setLoadError(e instanceof Error ? e.message : 'Failed to load profile')
        setLoading(false)
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [username])

  async function handleFollowToggle() {
    if (followInProgressRef.current) return
    if (!currentUserId || !profileUserId || currentUserId === profileUserId) return

    followInProgressRef.current = true
    setFollowLoading(true)
    setActionError('')

    try {
      if (isFollowing) {
        const { error } = await supabaseRef.current
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileUserId)

        if (error) {
          setActionError(error.message)
          return
        }

        setIsFollowing(false)
        setFollowersCount((prev) => Math.max(prev - 1, 0))
        return
      }

      const { error } = await supabaseRef.current.from('follows').insert({
        follower_id: currentUserId,
        following_id: profileUserId,
      })

      if (error) {
        setActionError(error.message)
        return
      }

      setIsFollowing(true)
      setFollowersCount((prev) => prev + 1)
    } finally {
      followInProgressRef.current = false
      setFollowLoading(false)
    }
  }

  async function handleDeletePost(postId: string) {
    if (!currentUserId) return

    const confirmed = window.confirm('Delete this post? This action cannot be undone.')
    if (!confirmed) return

    setDeletingPostId(postId)
    setActionError('')

    const { error } = await supabaseRef.current
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', currentUserId)

    if (error) {
      setActionError(`Failed to delete post: ${error.message}`)
      setDeletingPostId(null)
      return
    }

    setPosts((prev) => prev.filter((post) => post.id !== postId))
    setDeletingPostId(null)
  }

  const totalLikes = posts.reduce((sum, post) => sum + (post.like_count ?? 0), 0)
  const totalComments = posts.reduce((sum, post) => sum + (post.comment_count ?? 0), 0)

  const isOwnProfile =
    !!currentUserId && !!profileUserId && currentUserId === profileUserId

  const displayUsername = profileUsername || username || 'unknown'

  const safeXp = Math.max(0, profileXp)
  const level = getLevelFromXp(safeXp)
  const currentLevelXp = getXpIntoCurrentLevel(safeXp)
  const xpNeeded = 100 - currentLevelXp
  const progressPercent = Math.min((currentLevelXp / 100) * 100, 100)

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            @{displayUsername}
          </h1>
          <p style={{ marginTop: 8, opacity: 0.75 }}>Profile Page MVP</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/feed')} style={btnStyle}>
            ← Feed
          </button>
          <button onClick={() => router.push('/notifications')} style={btnStyle}>
            Notifications
          </button>
          <button onClick={() => router.push('/')} style={btnStyle}>
            Home
          </button>

          {!loading && profileExists && !isOwnProfile && currentUserId && profileUserId && (
            <button
              onClick={() => void handleFollowToggle()}
              style={btnStyle}
              disabled={followLoading}
            >
              {followLoading ? 'Please wait...' : isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {!loading && actionError && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: '1px solid #f59e0b',
            borderRadius: 8,
            background: '#fffbeb',
            color: '#92400e',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>Action error</p>
          <p style={{ marginTop: 6, marginBottom: 0 }}>{actionError}</p>
        </div>
      )}

      {!loading && !loadError && profileExists && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <span style={pillStyle}>📝 Posts: {posts.length}</span>
            <span style={pillStyle}>❤️ Likes: {totalLikes}</span>
            <span style={pillStyle}>💬 Comments: {totalComments}</span>
            <span style={pillStyle}>👥 Followers: {followersCount}</span>
            <span style={pillStyle}>➡️ Following: {followingCount}</span>
          </div>

          <section
            style={{
              marginBottom: 16,
              padding: 12,
              border: '1px solid #444',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  Level {level}
                </div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  {safeXp} total XP
                </div>
              </div>

              <div style={pillStyle}>{currentLevelXp}/100 XP</div>
            </div>

            <div
              style={{
                height: 10,
                width: '100%',
                overflow: 'hidden',
                borderRadius: 999,
                background: '#2a2a2a',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: '#f5f5f5',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            <div
              style={{
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              <span>{Math.round(progressPercent)}% complete</span>
              <span>{xpNeeded} XP to next level</span>
            </div>
          </section>
        </>
      )}

      {loading && <p>Loading profile...</p>}

      {!loading && !!loadError && (
        <div style={{ padding: 12, border: '1px solid #f00', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Error</p>
          <p style={{ marginTop: 6 }}>{loadError}</p>
        </div>
      )}

      {!loading && !loadError && !profileExists && (
        <div style={{ padding: 12, border: '1px solid #444', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Profile not found</p>
          <p style={{ marginTop: 6 }}>
            No profile exists for username: <strong>@{username}</strong>
          </p>
        </div>
      )}

      {!loading && !loadError && profileExists && posts.length === 0 && (
        <div style={{ padding: 12, border: '1px solid #444', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>No posts yet</p>
          <p style={{ marginTop: 6 }}>
            This profile exists, but there are no posts yet.
          </p>
        </div>
      )}

      {!loading && !loadError && profileExists && posts.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {posts.map((post) => {
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {new Date(post.created_at).toLocaleString()}
                  </div>

                  {isOwnPost && (
                    <button
                      onClick={() => void handleDeletePost(post.id)}
                      style={deleteBtnStyle}
                      disabled={isDeletingThisPost}
                    >
                      {isDeletingThisPost ? 'Deleting...' : 'Delete post'}
                    </button>
                  )}
                </div>

                {post.content && (
                  <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                    {post.content}
                  </div>
                )}

                {post.image_url && (
                  <img src={post.image_url} alt="Post image" style={imageStyle} />
                )}

                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={pillStyle}>❤️ {post.like_count ?? 0}</span>
                  <span style={pillStyle}>💬 {post.comment_count ?? 0}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}