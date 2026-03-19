'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type XPProgressBarProps = {
  userId: string
  className?: string
}

function getLevelFromXp(xp: number): number {
  return Math.floor(xp / 100) + 1
}

function getXpIntoCurrentLevel(xp: number): number {
  return xp % 100
}

function getXpNeededForNextLevel(xp: number): number {
  return 100 - (xp % 100 || 100)
}

export default function XPProgressBar({
  userId,
  className = '',
}: XPProgressBarProps) {
  const supabaseRef = useRef(createClient())

  const [xp, setXp] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadXp() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabaseRef.current
        .from('profiles')
        .select('xp_total')
        .eq('id', userId)
        .single()

      if (cancelled) return

      if (error) {
        setError(error.message || 'Failed to load XP')
        setLoading(false)
        return
      }

      setXp(data?.xp_total ?? 0)
      setLoading(false)
    }

    loadXp()

    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}
      >
        <div className="mb-2 text-sm font-medium text-zinc-300">
          XP Progress
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-600" />
        </div>
        <div className="mt-2 text-xs text-zinc-500">Loading XP...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`rounded-2xl border border-red-900/50 bg-red-950/30 p-4 ${className}`}
      >
        <div className="text-sm font-medium text-red-300">XP Progress</div>
        <div className="mt-2 text-xs text-red-400">
          Failed to load XP. Please refresh the page.
        </div>
      </div>
    )
  }

  const safeXp = Math.max(0, xp)
  const level = getLevelFromXp(safeXp)
  const currentLevelXp = getXpIntoCurrentLevel(safeXp)
  const progressPercent = Math.min((currentLevelXp / 100) * 100, 100)

  const rawNeeded = getXpNeededForNextLevel(safeXp)
  const xpNeeded = rawNeeded === 0 ? 100 : rawNeeded

  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Level {level}</div>
          <div className="text-xs text-zinc-400">{safeXp} total XP</div>
        </div>

        <div className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200">
          {currentLevelXp}/100 XP
        </div>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-white/90 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
        <span>{Math.round(progressPercent)}% complete</span>
        <span>{xpNeeded} XP to next level</span>
      </div>
    </div>
  )
}