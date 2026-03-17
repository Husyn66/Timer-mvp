'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string | null
  image_url: string | null
  created_at: string
  like_count: number | null
  comment_count: number | null
}

type CommentRow = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
}

type ProfileRow = {
  id: string
  username: string | null
}

const navButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #4b5563',
  background: '#f3f4f6',
  color: '#111827',
  cursor: 'pointer',
  fontWeight: 700,
}

const metricStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 8,
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.12)',
  fontSize: 12,
  color: '#e5e7eb',
  background: 'rgba(255,255,255,0.06)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 96,
  padding: 12,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(17,24,39,0.82)',
  color: '#f9fafb',
  outline: 'none',
  resize: 'vertical',
}

const submitButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: 'none',
  background: '#ffffff',
  color: '#111827',
  cursor: 'pointer',
  fontWeight: 800,
  minWidth: 120,
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return date.toLocaleString()
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const rawPostId = params?.id ?? ''
  const postId = decodeURIComponent(rawPostId)

  const [post, setPost] = useState<PostRow | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [commentAuthors, setCommentAuthors] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    let active = true

    async function loadPage() {
      setLoading(true)
      setError('')
      setPost(null)
      setComments([])
      setCommentAuthors({})

      try {
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession()

        if (!active) return

        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }

        setCurrentUserId(session?.user?.id ?? null)

        const { data: postData, error: postError } = await supabase
          .from('feed_posts')
          .select(
            'id, user_id, username, content, image_url, created_at, like_count, comment_count'
          )
          .eq('id', postId)
          .maybeSingle()

        if (!active) return

        if (postError) {
          setError(postError.message)
          setLoading(false)
          return
        }

        if (!postData) {
          setLoading(false)
          return
        }

        const typedPost = postData as PostRow
        setPost(typedPost)

        const { data: commentData, error: commentError } = await supabase
          .from('post_comments')
          .select('id, post_id, user_id, content, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: true })

        if (!active) return

        if (commentError) {
          setError(commentError.message)
          setLoading(false)
          return
        }

        const typedComments = (commentData ?? []) as CommentRow[]
        setComments(typedComments)

        const userIds = Array.from(new Set(typedComments.map((c) => c.user_id).filter(Boolean)))

        if (userIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds)

          if (!active) return

          if (profileError) {
            setError(profileError.message)
            setLoading(false)
            return
          }

          const map: Record<string, string> = {}

          ;((profileRows ?? []) as ProfileRow[]).forEach((profileRow) => {
            map[profileRow.id] = profileRow.username?.trim() || 'unknown'
          })

          setCommentAuthors(map)
        }

        setLoading(false)
      } catch (e: unknown) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Unknown error')
        setLoading(false)
      }
    }

    if (postId) {
      void loadPage()
    } else {
      setError('Invalid post id.')
      setLoading(false)
    }

    return () => {
      active = false
    }
  }, [postId, supabase])

  async function handleAddComment() {
    const content = commentText.trim()

    if (!currentUserId) {
      setError('You must be logged in to comment.')
      return
    }

    if (!post) {
      setError('Post not found.')
      return
    }

    if (!content) {
      setError('Comment cannot be empty.')
      return
    }

    if (submitting) return

    setSubmitting(true)
    setError('')

    try {
      const { data: insertedComment, error: insertError } = await supabase
        .from('post_comments')
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content,
        })
        .select('id, post_id, user_id, content, created_at')
        .single()

      if (insertError) {
        setError(insertError.message)
        setSubmitting(false)
        return
      }

      const typedInserted = insertedComment as CommentRow

      setComments((prev) => [...prev, typedInserted])
      setCommentText('')
      setPost((prev) =>
        prev
          ? {
              ...prev,
              comment_count: (prev.comment_count ?? 0) + 1,
            }
          : prev
      )

      if (!commentAuthors[currentUserId]) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', currentUserId)
          .maybeSingle()

        const typedProfile = myProfile as ProfileRow | null

        setCommentAuthors((prev) => ({
          ...prev,
          [currentUserId]: typedProfile?.username?.trim() || 'unknown',
        }))
      }

      if (post.user_id !== currentUserId) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: currentUserId,
          type: 'comment',
          post_id: post.id,
        })

        if (notificationError) {
          console.error('Comment notification failed:', notificationError)
        }
      }

      setSubmitting(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add comment')
      setSubmitting(false)
    }
  }

  const profileUsername = post?.username?.trim() || ''

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/feed')} style={navButtonStyle}>
            ← Feed
          </button>
          <button onClick={() => router.push('/notifications')} style={navButtonStyle}>
            Notifications
          </button>
          <button onClick={() => router.back()} style={navButtonStyle}>
            Back
          </button>
        </div>
      </div>

      {loading && <p style={{ color: '#fff' }}>Loading post...</p>}

      {!loading && error && (
        <div
          style={{
            padding: 14,
            border: '1px solid #ef4444',
            borderRadius: 10,
            color: '#fff',
            background: 'rgba(127, 29, 29, 0.22)',
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontWeight: 800 }}>Error</p>
          <p style={{ marginTop: 6 }}>{error}</p>
        </div>
      )}

      {!loading && !error && !post && (
        <div
          style={{
            padding: 14,
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 16,
            background: 'rgba(17,24,39,0.75)',
            color: '#fff',
          }}
        >
          <p style={{ margin: 0, fontWeight: 800 }}>Post not found</p>
          <p style={{ marginTop: 6 }}>No post exists for this id.</p>
        </div>
      )}

      {!loading && post && (
        <>
          <article
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 20,
              padding: 18,
              background: 'rgba(17,24,39,0.82)',
              color: '#f9fafb',
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => {
                  if (!profileUsername) return
                  router.push(`/profile/${encodeURIComponent(profileUsername)}`)
                }}
                disabled={!profileUsername}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: profileUsername ? '#93c5fd' : '#9ca3af',
                  cursor: profileUsername ? 'pointer' : 'default',
                  fontWeight: 800,
                  padding: 0,
                }}
              >
                @{profileUsername || 'unknown'}
              </button>

              <div style={{ fontSize: 12, opacity: 0.72, color: '#d1d5db' }}>
                {formatDate(post.created_at)}
              </div>
            </div>

            {post.content && (
              <div
                style={{
                  marginTop: 14,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  color: '#f3f4f6',
                }}
              >
                {post.content}
              </div>
            )}

            {post.image_url && (
              <img
                src={post.image_url}
                alt="Post image"
                style={{
                  width: '100%',
                  maxHeight: 520,
                  objectFit: 'cover',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                  marginTop: 14,
                }}
              />
            )}

            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={metricStyle}>❤️ {post.like_count ?? 0}</span>
              <span style={metricStyle}>💬 {post.comment_count ?? 0}</span>
            </div>
          </article>

          <section
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 20,
              padding: 18,
              background: 'rgba(17,24,39,0.82)',
              color: '#f9fafb',
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
              marginBottom: 18,
            }}
          >
            <h2 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 900 }}>Add comment</h2>

            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write your comment..."
              style={inputStyle}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                onClick={() => void handleAddComment()}
                disabled={submitting}
                style={{
                  ...submitButtonStyle,
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Sending...' : 'Post comment'}
              </button>
            </div>
          </section>

          <section
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 20,
              padding: 18,
              background: 'rgba(17,24,39,0.82)',
              color: '#f9fafb',
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
            }}
          >
            <h2 style={{ margin: '0 0 14px 0', fontSize: 20, fontWeight: 900 }}>
              Comments ({comments.length})
            </h2>

            {comments.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  color: '#d1d5db',
                }}
              >
                No comments yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {comments.map((comment) => (
                  <article
                    key={comment.id}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#93c5fd' }}>
                        @{commentAuthors[comment.user_id] || 'unknown'}
                      </div>

                      <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        {formatDate(comment.created_at)}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.55,
                        color: '#f3f4f6',
                      }}
                    >
                      {comment.content}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}