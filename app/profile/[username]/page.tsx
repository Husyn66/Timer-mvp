'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function ProfilePage() {
  const params = useParams<{ username: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const rawUsername = params?.username ?? ''
  const username = decodeURIComponent(rawUsername)

  const [posts, setPosts] = useState<ProfilePost[]>([])
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileExists, setProfileExists] = useState(true)

  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError('')
      setProfileExists(true)

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (!active) return

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      setCurrentUserId(user?.id ?? null)

      const { data, error } = await supabase
        .from('feed_posts')
        .select(
          'id, content, image_url, created_at, user_id, username, like_count, comment_count'
        )
        .eq('username', username)
        .order('created_at', { ascending: false })

      if (!active) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const rows = (data ?? []) as ProfilePost[]

      setPosts(rows)
      setProfileExists(rows.length > 0)

      if (rows.length === 0) {
        setProfileUserId(null)
        setFollowersCount(0)
        setFollowingCount(0)
        setIsFollowing(false)
        setLoading(false)
        return
      }

      const targetUserId = rows[0].user_id
      setProfileUserId(targetUserId)

      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetUserId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', targetUserId),
      ])

      if (!active) return

      setFollowersCount(followers ?? 0)
      setFollowingCount(following ?? 0)

      if (user?.id && user.id !== targetUserId) {
        const { data: followRow, error: followError } = await supabase
          .from('follows')
          .select('follower_id, following_id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle()

        if (!active) return

        if (followError) {
          setError(followError.message)
          setLoading(false)
          return
        }

        setIsFollowing(!!followRow)
      } else {
        setIsFollowing(false)
      }

      setLoading(false)
    }

    if (username) {
      void loadProfile()
    } else {
      setError('Invalid username.')
      setLoading(false)
    }

    return () => {
      active = false
    }
  }, [supabase, username])

  async function handleFollowToggle() {
    if (!currentUserId || !profileUserId || currentUserId === profileUserId) return

    setFollowLoading(true)
    setError('')

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileUserId)

      if (error) {
        setError(error.message)
        setFollowLoading(false)
        return
      }

      setIsFollowing(false)
      setFollowersCount((prev) => Math.max(prev - 1, 0))
      setFollowLoading(false)
      return
    }

    const { error } = await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: profileUserId,
    })

    if (error) {
      setError(error.message)
      setFollowLoading(false)
      return
    }

    setIsFollowing(true)
    setFollowersCount((prev) => prev + 1)
    setFollowLoading(false)
  }

  const totalLikes = posts.reduce((sum, post) => sum + (post.like_count ?? 0), 0)
  const totalComments = posts.reduce((sum, post) => sum + (post.comment_count ?? 0), 0)

  const isOwnProfile =
    !!currentUserId && !!profileUserId && currentUserId === profileUserId

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
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>@{username}</h1>
          <p style={{ marginTop: 8, opacity: 0.75 }}>Profile Page MVP</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/feed')} style={btnStyle}>
            ← Feed
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

      {!loading && !error && profileExists && (
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
      )}

      {loading && <p>Loading profile...</p>}

      {!loading && error && (
        <div style={{ padding: 12, border: '1px solid #f00', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Error</p>
          <p style={{ marginTop: 6 }}>{error}</p>
        </div>
      )}

      {!loading && !error && !profileExists && (
        <div style={{ padding: 12, border: '1px solid #444', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Profile not found</p>
          <p style={{ marginTop: 6 }}>
            No posts found for username: <strong>@{username}</strong>
          </p>
        </div>
      )}

      {!loading && !error && profileExists && (
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
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(post.created_at).toLocaleString()}
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
          ))}
        </div>
      )}
    </main>
  )
}