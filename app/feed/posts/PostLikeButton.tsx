'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  postId: string
  className?: string
}

export default function PostLikeButton({ postId, className }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [likeCount, setLikeCount] = useState<number>(0)
  const [liked, setLiked] = useState<boolean>(false)
  const [busy, setBusy] = useState<boolean>(false)
  const [ready, setReady] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setReady(false)

      const { data: authRes, error: authErr } = await supabase.auth.getUser()
      if (authErr) {
        console.error('auth.getUser error', authErr)
        if (!cancelled) setReady(true)
        return
      }

      const userId = authRes.user?.id
      if (!userId) {
        // Не залогинен — покажем только общий счётчик
        const { count, error: countErr } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)

        if (countErr) console.error('like count error', countErr)
        if (!cancelled) setLikeCount(count ?? 0)
        if (!cancelled) setLiked(false)
        if (!cancelled) setReady(true)
        return
      }

      // 1) общий счётчик
      const { count, error: countErr } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)

      if (countErr) console.error('like count error', countErr)
      if (!cancelled) setLikeCount(count ?? 0)

      // 2) лайкнул ли я
      const { data: mine, error: mineErr } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle()

      if (mineErr) console.error('liked_by_me error', mineErr)
      if (!cancelled) setLiked(!!mine)

      if (!cancelled) setReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [postId, supabase])

  async function toggleLike() {
    if (!ready || busy) return
    setBusy(true)

    try {
      const { data: authRes, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr

      const userId = authRes.user?.id
      if (!userId) throw new Error('Not authenticated')

      if (liked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId)

        if (error) throw error

        setLiked(false)
        setLikeCount((c) => Math.max(0, c - 1))
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: userId })

        // Если unique(post_id,user_id) есть — двойной клик не создаст дубль, но может вернуть ошибку.
        // MVP: просто логируем.
        if (error) throw error

        setLiked(true)
        setLikeCount((c) => c + 1)
      }
    } catch (e) {
      console.error('toggleLike error', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggleLike}
      disabled={!ready || busy}
      className={className}
      aria-label={liked ? 'Unlike' : 'Like'}
      title={liked ? 'Unlike' : 'Like'}
    >
      <span style={{ marginRight: 6 }}>{liked ? '❤️' : '🤍'}</span>
      <span>{likeCount}</span>
    </button>
  )
}