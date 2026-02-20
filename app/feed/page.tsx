'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type FeedItem = {
  id: string
  content: string
  created_at: string
  username: string
  like_count: number
  comment_count: number
}

type CommentItem = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  username: string
}

export default function FeedPage() {
  const supabase = createClient()

  const [items, setItems] = useState<FeedItem[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const [newPost, setNewPost] = useState('')
  const [message, setMessage] = useState('')

  // comments UI state
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({})
  const [draftByPost, setDraftByPost] = useState<Record<string, string>>({})
  const [loadingCommentsFor, setLoadingCommentsFor] = useState<string | null>(null)

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        setMessage('Auth error: ' + error.message)
        return
      }
      setUserId(data.user?.id ?? null)
    }
    loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load feed
  const loadFeed = async () => {
    const { data, error } = await supabase
      .from('feed_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      setMessage('Feed error: ' + error.message)
      return
    }

    setItems((data as FeedItem[]) || [])
  }

  useEffect(() => {
    loadFeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Create post
  const createPost = async () => {
    setMessage('')
    if (!userId) {
      setMessage('Please login first.')
      return
    }
    if (!newPost.trim()) {
      setMessage('Please write something.')
      return
    }

    const { error } = await supabase.from('posts').insert({
      content: newPost.trim(),
      user_id: userId,
    })

    if (error) {
      setMessage('Create post error: ' + error.message)
      return
    }

    setNewPost('')
    await loadFeed()
  }

  // Toggle like
  const toggleLike = async (postId: string) => {
    setMessage('')
    if (!userId) {
      setMessage('Please login first.')
      return
    }

    const { data: existing, error: exErr } = await supabase
      .from('post_likes')
      .select('post_id,user_id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()

    if (exErr) {
      setMessage('Like check error: ' + exErr.message)
      return
    }

    if (existing) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)

      if (error) {
        setMessage('Unlike error: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase.from('post_likes').insert({
        post_id: postId,
        user_id: userId,
      })

      if (error) {
        // если вдруг поймаешь unique constraint (гонка кликов) — не паника, просто перегрузи фид
        setMessage('Like error: ' + error.message)
        await loadFeed()
        return
      }
    }

    await loadFeed()
  }

  // Load comments for a post
  const loadComments = async (postId: string) => {
    setMessage('')
    setLoadingCommentsFor(postId)

    const { data, error } = await supabase
      .from('post_comment_items')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(50)

    setLoadingCommentsFor(null)

    if (error) {
      setMessage('Load comments error: ' + error.message)
      return
    }

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (data as CommentItem[]) || [],
    }))
  }

  // Add comment
  const addComment = async (postId: string) => {
    setMessage('')
    if (!userId) {
      setMessage('Please login first.')
      return
    }

    const text = (draftByPost[postId] || '').trim()
    if (!text) {
      setMessage('Comment is empty.')
      return
    }

    const { error } = await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: userId,
      content: text,
    })

    if (error) {
      setMessage('Add comment error: ' + error.message)
      return
    }

    // очистить черновик
    setDraftByPost((prev) => ({ ...prev, [postId]: '' }))

    // обновить и comments и feed (чтобы comment_count вырос)
    await loadComments(postId)
    await loadFeed()
  }

  // Toggle comments panel
  const toggleCommentsPanel = async (postId: string) => {
    if (openPostId === postId) {
      setOpenPostId(null)
      return
    }
    setOpenPostId(postId)

    // lazy-load
    if (!commentsByPost[postId]) {
      await loadComments(postId)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 20 }}>
      <h1>Feed</h1>

      <textarea
        value={newPost}
        onChange={(e) => setNewPost(e.target.value)}
        placeholder="Write a post..."
        style={{
          width: '100%',
          height: 90,
          marginBottom: 10,
          padding: 10,
          borderRadius: 8,
        }}
      />

      <div style={{ marginBottom: 18 }}>
        <button onClick={createPost}>Post</button>
        <button onClick={loadFeed} style={{ marginLeft: 10 }}>
          Refresh
        </button>
      </div>

      {message && <p style={{ opacity: 0.9 }}>{message}</p>}

      {items.map((p) => (
        <article
          key={p.id}
          style={{
            border: '1px solid #333',
            padding: 12,
            marginBottom: 12,
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong>@{p.username}</strong>
            <small style={{ opacity: 0.8 }}>{new Date(p.created_at).toLocaleString()}</small>
          </div>

          <p style={{ margin: '10px 0' }}>{p.content}</p>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => toggleLike(p.id)}>
              ❤️ {p.like_count}
            </button>

            <button onClick={() => toggleCommentsPanel(p.id)}>
              💬 {p.comment_count}
            </button>
          </div>

          {openPostId === p.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #444' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={draftByPost[p.id] || ''}
                  onChange={(e) =>
                    setDraftByPost((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder="Write a comment..."
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #444',
                    background: 'transparent',
                    color: 'inherit',
                  }}
                />
                <button onClick={() => addComment(p.id)}>Send</button>
                <button onClick={() => loadComments(p.id)} disabled={loadingCommentsFor === p.id}>
                  {loadingCommentsFor === p.id ? 'Loading…' : 'Reload'}
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                {(commentsByPost[p.id] || []).length === 0 ? (
                  <p style={{ opacity: 0.8, marginTop: 10 }}>No comments yet.</p>
                ) : (
                  (commentsByPost[p.id] || []).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        marginTop: 10,
                        padding: 10,
                        border: '1px solid #2f2f2f',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <strong>@{c.username}</strong>
                        <small style={{ opacity: 0.8 }}>
                          {new Date(c.created_at).toLocaleString()}
                        </small>
                      </div>
                      <div style={{ marginTop: 6 }}>{c.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </article>
      ))}
    </main>
  )
}
