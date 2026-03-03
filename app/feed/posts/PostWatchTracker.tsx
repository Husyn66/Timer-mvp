'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  postId: string
  children: React.ReactNode
}

export default function PostWatchTracker({ postId, children }: Props) {
  const [seconds, setSeconds] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const ref = useRef<HTMLDivElement | null>(null)
  const lastTickRef = useRef<number | null>(null)
  const runningRef = useRef(false)

  const storageKey = useMemo(() => `timer:watch:${postId}`, [postId])

  // Загружаем сохранённое значение
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const num = Number(saved)
      if (!isNaN(num)) setSeconds(num)
    }
  }, [storageKey])

  // IntersectionObserver — определяем видимость
  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.6)
      },
      { threshold: [0, 0.6, 1] }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  // Таймер реального просмотра
  useEffect(() => {
    if (!isVisible || document.visibilityState !== 'visible') {
      runningRef.current = false
      lastTickRef.current = null
      return
    }

    runningRef.current = true
    lastTickRef.current = performance.now()

    const interval = setInterval(() => {
      if (!runningRef.current) return
      if (document.visibilityState !== 'visible') return

      const now = performance.now()
      const last = lastTickRef.current ?? now
      const delta = now - last

      if (delta > 200 && delta < 2000) {
        setSeconds((prev) => {
          const next = prev + delta / 1000
          localStorage.setItem(storageKey, String(Math.floor(next)))
          return next
        })
      }

      lastTickRef.current = now
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, storageKey])

  return (
    <div ref={ref}>
      {children}

      <div
        style={{
          marginTop: 8,
          padding: 6,
          fontSize: 12,
          border: '1px solid #0f0',
          borderRadius: 6,
          opacity: 0.8,
        }}
      >
        You watched: <strong>{Math.floor(seconds)}</strong>s
      </div>
    </div>
  )
}