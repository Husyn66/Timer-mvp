'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PostLikeButton({
  postId,
  postOwnerId,
  currentUserId,
  initialLiked,
  initialCount,
  onToggle,
}: {
  postId: string
  postOwnerId: string
  currentUserId: string | null
  initialLiked: boolean
  initialCount: number
  onToggle: (postId: string, nextLiked: boolean) => void
}) {
  const supabase = useMemo(() => createClient(), [])

  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLiked(initialLiked)
    setCount(initialCount)
  }, [initialLiked, initialCount])

  useEffect(() => {
    if (!currentUserId) {
      setLiked(false)
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('post_likes')
        .select('user_id')
        .eq('post_id', postId)

      if (cancelled) return

      if (error) {
        setLoading(false)
        return
      }

      const rows = data ?? []
      const total = rows.length
      const isLiked = rows.some((row: any) => row.user_id === currentUserId)

      setCount(total)
      setLiked(isLiked)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [postId, currentUserId, supabase])

  const toggle = async () => {
    if (!currentUserId || loading) return

    setLoading(true)

    try {
      if (liked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId)

        if (error) throw error

        setLiked(false)
        setCount((c) => Math.max(c - 1, 0))
        onToggle(postId, false)
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: currentUserId,
          })

        if (error) throw error

        if (currentUserId !== postOwnerId) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: postOwnerId,
              actor_id: currentUserId,
              type: 'like',
              post_id: postId,
            })

          if (notificationError) {
            console.error('Like notification failed:', notificationError)
          }
        }

        setLiked(true)
        setCount((c) => c + 1)
        onToggle(postId, true)
      }
    } catch (err) {
      console.error('Like toggle failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={() => void toggle()}
      disabled={loading || !currentUserId}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: loading || !currentUserId ? 'default' : 'pointer',
        fontSize: 18,
        opacity: loading || !currentUserId ? 0.7 : 1,
      }}
    >
      {liked ? '❤️' : '🤍'} {count}
    </button>
  )
}