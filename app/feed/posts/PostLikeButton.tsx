'use client'

import { useEffect, useRef, useState } from 'react'
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
  const supabaseRef = useRef(createClient())
  const mountedRef = useRef(true)

  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setLiked(initialLiked)
    setCount(initialCount)
  }, [initialLiked, initialCount])

  const toggle = async () => {
    if (!currentUserId || loading) return

    const supabase = supabaseRef.current
    const prevLiked = liked
    const prevCount = count
    const nextLiked = !prevLiked
    const nextCount = nextLiked ? prevCount + 1 : Math.max(prevCount - 1, 0)

    setLoading(true)
    setLiked(nextLiked)
    setCount(nextCount)
    onToggle(postId, nextLiked)

    try {
      if (prevLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId)

        if (error) {
          throw new Error(`Failed to remove like: ${error.message}`)
        }
      } else {
        const { error } = await supabase.from('post_likes').insert({
          post_id: postId,
          user_id: currentUserId,
        })

        if (error) {
          const message = error.message.toLowerCase()
          const isDuplicate =
            error.code === '23505' ||
            message.includes('duplicate key') ||
            message.includes('already exists')

          if (!isDuplicate) {
            throw new Error(`Failed to add like: ${error.message}`)
          }
        }

        if (currentUserId !== postOwnerId) {
          const { error: notificationError } = await supabase.from('notifications').insert({
            user_id: postOwnerId,
            actor_id: currentUserId,
            type: 'like',
            post_id: postId,
          })

          if (notificationError) {
            console.error('Like notification failed:', notificationError)
          }
        }
      }
    } catch (err) {
      console.error('Like toggle failed:', err)

      if (!mountedRef.current) return

      setLiked(prevLiked)
      setCount(prevCount)
      onToggle(postId, prevLiked)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
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
      aria-label={liked ? 'Unlike post' : 'Like post'}
    >
      {loading ? '⏳' : liked ? '❤️' : '🤍'} {count}
    </button>
  )
}