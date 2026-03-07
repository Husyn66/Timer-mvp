'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  postId: string
  children: React.ReactNode
}

export default function PostWatchTracker({ postId, children }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [seconds, setSeconds] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const ref = useRef<HTMLDivElement | null>(null)
  const lastTickRef = useRef<number | null>(null)
  const runningRef = useRef(false)

  const secondsRef = useRef(0)
  const lastSavedRef = useRef<number>(0)

  const storageKey = useMemo(() => `timer:watch:${postId}`, [postId])

  // Restore local seconds
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const n = raw ? Number(raw) : 0
      const safe = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
      setSeconds(safe)
      secondsRef.current = safe
    } catch {
      // ignore
    }
  }, [storageKey])

  // Track visibility (>= 60% of the element in viewport)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        setIsVisible(e.isIntersecting && e.intersectionRatio >= 0.6)
      },
      { threshold: [0, 0.6, 1] }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const upsertWatch = async (totalSeconds: number) => {
    const floored = Math.floor(totalSeconds)

    // Save only every 15 seconds and only forward
    if (floored <= 0) return
    if (floored % 15 !== 0) return
    if (floored <= lastSavedRef.current) return

    lastSavedRef.current = floored

    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr) return

    const userId = auth.user?.id
    if (!userId) return

    await supabase
      .from('post_watch_time')
      .upsert(
        {
          user_id: userId,
          post_id: postId,
          seconds: floored,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,post_id' }
      )
  }

  // Real watch-time ticking
  useEffect(() => {
    const canRun = isVisible && document.visibilityState === 'visible'
    if (!canRun) {
      runningRef.current = false
      lastTickRef.current = null
      return
    }

    runningRef.current = true
    lastTickRef.current = performance.now()

    const id = window.setInterval(() => {
      if (!runningRef.current) return
      if (document.visibilityState !== 'visible') return

      const now = performance.now()
      const last = lastTickRef.current ?? now
      const deltaMs = now - last

      // Guard against sleep/lag spikes
      if (deltaMs >= 200 && deltaMs <= 2000) {
        const add = deltaMs / 1000
        const next = secondsRef.current + add

        secondsRef.current = next
        setSeconds(next)

        try {
          localStorage.setItem(storageKey, String(Math.floor(next)))
        } catch {
          // ignore
        }

        void upsertWatch(next)
      }

      lastTickRef.current = now
    }, 1000)

    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, storageKey, postId])

  return (
    <div ref={ref}>
      {children}

      <div
        style={{
          marginTop: 8,
          padding: 6,
          fontSize: 12,
          border: '1px solid #0f0',
          borderRadius: 8,
          opacity: 0.9,
        }}
      >
        You watched: <strong>{Math.floor(seconds)}</strong>s
      </div>
    </div>
  )
}