'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchWithRetry } from '@/lib/fetchWithRetry'

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
  const [loading, setLoading] = useState(false)

  const mountedRef = useRef(true)

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

  const shouldRetryLikeError = (error: unknown) => {
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

  const toggle = async () => {
    if (!currentUserId || loading) return

    const prevLiked = liked
    const prevCount = count

    const nextLiked = !prevLiked
    const nextCount = nextLiked ? prevCount + 1 : Math.max(prevCount - 1, 0)

    setLoading(true)

    // optimistic UI
    setLiked(nextLiked)
    setCount(nextCount)
    onToggle(postId, nextLiked)

    try {
      if (prevLiked) {
        await fetchWithRetry(
          async () => {
            const { error } = await supabase
              .from('post_likes')
              .delete()
              .eq('post_id', postId)
              .eq('user_id', currentUserId)

            if (error) {
              throw new Error(`Failed to remove like: ${error.message}`)
            }
          },
          {
            retries: 1,
            delayMs: 700,
            shouldRetry: shouldRetryLikeError,
          }
        )
      } else {
        await fetchWithRetry(
          async () => {
            const { error } = await supabase
              .from('post_likes')
              .insert({
                post_id: postId,
                user_id: currentUserId,
              })

            if (error) {
              throw new Error(`Failed to add like: ${error.message}`)
            }
          },
          {
            retries: 1,
            delayMs: 700,
            shouldRetry: shouldRetryLikeError,
          }
        )

        if (currentUserId !== postOwnerId) {
          try {
            await fetchWithRetry(
              async () => {
                const { error } = await supabase
                  .from('notifications')
                  .insert({
                    user_id: postOwnerId,
                    actor_id: currentUserId,
                    type: 'like',
                    post_id: postId,
                  })

                if (error) {
                  throw new Error(`Like notification failed: ${error.message}`)
                }
              },
              {
                retries: 1,
                delayMs: 700,
                shouldRetry: shouldRetryLikeError,
              }
            )
          } catch (notificationErr) {
            console.error('Like notification failed:', notificationErr)
          }
        }
      }
    } catch (err) {
      console.error('Like toggle failed:', err)

      // rollback
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