'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type CommentRow = {
  id: string
  content: string
  created_at: string
  user_id: string
}

export default function PostComments({
  postId,
  currentUserId,
  onCommentAdded,
}: {
  postId: string
  currentUserId: string | null
  onCommentAdded?: () => void
}) {
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<CommentRow[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    setLoading(true)

    const { data, error } = await supabase
      .from('post_comments')
      .select('id, content, created_at, user_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      setError(error.message)
      setItems([])
      setLoading(false)
      return
    }

    const rows = (data ?? []) as CommentRow[]
    setItems(rows)

    const uniqueUserIds = Array.from(new Set(rows.map((r) => r.user_id)))

    if (uniqueUserIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', uniqueUserIds)

      if (!profErr && profs) {
        const map: Record<string, string> = {}
        for (const p of profs as any[]) {
          map[p.id] = p.username ?? 'user'
        }
        setUsernames(map)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [postId])

  async function send() {
    const trimmed = text.trim()
    if (!trimmed) return

    if (!currentUserId) {
      setError('You must be logged in to comment.')
      return
    }

    setSending(true)
    setError('')

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
      setError(error.message)
      setSending(false)
      return
    }

    const newItem = data as CommentRow

    setItems((prev) => [newItem, ...prev])
    setUsernames((prev) => ({
      ...prev,
      [currentUserId]: prev[currentUserId] ?? 'user',
    }))
    setText('')
    setSending(false)
    onCommentAdded?.()
  }

  return (
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
          className="rounded-md px-3 py-2 text-sm bg-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          Send
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
                <div className="text-sm mt-1 whitespace-pre-wrap">{c.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}