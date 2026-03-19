'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchWithRetry } from '@/lib/fetchWithRetry'

type CommentRow = {
  id: string
  content: string
  created_at: string
  user_id: string
}

export default function PostComments({
  postId,
  postOwnerId,
  currentUserId,
  initialCount,
  onCommentAdded,
  toggleStyle,
}: {
  postId: string
  postOwnerId: string
  currentUserId: string | null
  initialCount: number
  onCommentAdded?: () => void
  toggleStyle?: CSSProperties
}) {
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<CommentRow[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [count, setCount] = useState(initialCount)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  const shouldRetryCommentError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

    return (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('temporar') ||
      message.includes('fetch')
    )
  }

  async function load() {
    setError('')
    setLoading(true)

    try {
      const rows = await fetchWithRetry(
        async () => {
          const { data, error } = await supabase
            .from('post_comments')
            .select('id, content, created_at, user_id')
            .eq('post_id', postId)
            .order('created_at', { ascending: false })
            .limit(50)

          if (error) {
            throw new Error(`Failed to load comments: ${error.message}`)
          }

          return (data ?? []) as CommentRow[]
        },
        {
          retries: 2,
          delayMs: 800,
          shouldRetry: shouldRetryCommentError,
        }
      )

      if (!mountedRef.current) return

      setItems(rows)

      const uniqueUserIds = Array.from(new Set(rows.map((r) => r.user_id)))

      if (uniqueUserIds.length > 0) {
        try {
          const profilesMap = await fetchWithRetry(
            async () => {
              const { data: profs, error: profErr } = await supabase
                .from('profiles')
                .select('id, username')
                .in('id', uniqueUserIds)

              if (profErr) {
                throw new Error(`Failed to load comment usernames: ${profErr.message}`)
              }

              const map: Record<string, string> = {}

              for (const p of (profs ?? []) as Array<{ id: string; username: string | null }>) {
                map[p.id] = p.username ?? 'user'
              }

              return map
            },
            {
              retries: 1,
              delayMs: 700,
              shouldRetry: shouldRetryCommentError,
            }
          )

          if (mountedRef.current) {
            setUsernames(profilesMap)
          }
        } catch (profileErr) {
          console.error('Failed to load comment usernames:', profileErr)
        }
      } else {
        setUsernames({})
      }

      if (mountedRef.current) {
        setLoaded(true)
      }
    } catch (err) {
      if (!mountedRef.current) return

      const msg = err instanceof Error ? err.message : 'Failed to load comments.'
      setError(msg)
      setItems([])
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    setItems([])
    setUsernames({})
    setText('')
    setLoading(false)
    setSending(false)
    setError('')
    setOpen(false)
    setLoaded(false)
    setCount(initialCount)
  }, [postId, initialCount])

  useEffect(() => {
    if (!open || loaded) return
    void load()
  }, [open, loaded])

  async function send() {
    const trimmed = text.trim()
    if (!trimmed) return

    if (!currentUserId) {
      setError('You must be logged in to comment.')
      return
    }

    if (sending) return

    setSending(true)
    setError('')

    try {
      const newItem = await fetchWithRetry(
        async () => {
          const { data, error } = await supabase
            .from('post_comments')
            .insert({
              post_id: postId,
              user_id: currentUserId,
              content: trimmed,
            })
            .select('id, content, created_at, user_id')
            .single()

          if (error) {
            throw new Error(`Failed to send comment: ${error.message}`)
          }

          return data as CommentRow
        },
        {
          retries: 1,
          delayMs: 700,
          shouldRetry: shouldRetryCommentError,
        }
      )

      if (currentUserId !== postOwnerId) {
        try {
          await fetchWithRetry(
            async () => {
              const { error: notificationError } = await supabase
                .from('notifications')
                .insert({
                  user_id: postOwnerId,
                  actor_id: currentUserId,
                  type: 'comment',
                  post_id: postId,
                })

              if (notificationError) {
                throw new Error(`Comment notification failed: ${notificationError.message}`)
              }
            },
            {
              retries: 1,
              delayMs: 700,
              shouldRetry: shouldRetryCommentError,
            }
          )
        } catch (notificationErr) {
          console.error('Comment notification failed:', notificationErr)
        }
      }

      if (!mountedRef.current) return

      setItems((prev) => [newItem, ...prev])
      setUsernames((prev) => ({
        ...prev,
        [currentUserId]: prev[currentUserId] ?? 'user',
      }))
      setText('')
      setOpen(true)
      setLoaded(true)
      setCount((prev) => prev + 1)
      onCommentAdded?.()
    } catch (err) {
      if (!mountedRef.current) return

      const msg = err instanceof Error ? err.message : 'Failed to send comment.'
      setError(msg)
    } finally {
      if (mountedRef.current) {
        setSending(false)
      }
    }
  }

  const buttonLabel = open ? 'Hide comments' : `Show comments (${count})`

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen((v) => !v)} style={toggleStyle}>
        {buttonLabel}
      </button>

      {!open ? null : (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={currentUserId ? 'Write a comment…' : 'Login to comment…'}
              className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none"
              maxLength={500}
              disabled={sending || !currentUserId}
            />
            <button
              onClick={() => void send()}
              disabled={sending || !currentUserId || text.trim().length === 0}
              className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {error ? <div className="mt-2 text-sm text-red-400">{error}</div> : null}

          <div className="mt-3">
            {loading ? (
              <div className="text-sm opacity-70">Loading comments…</div>
            ) : items.length === 0 ? (
              <div className="text-sm opacity-70">No comments yet.</div>
            ) : (
              <div className="space-y-2">
                {items.map((c) => (
                  <div key={c.id} className="rounded-md bg-white/5 px-3 py-2">
                    <div className="text-xs opacity-70">
                      {(usernames[c.user_id] ?? 'user')} • {new Date(c.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm">{c.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}