'use client'

import { getProgress } from '@/lib/xp'

export default function XPProgressBar({ xp }: { xp: number }) {
  const { level, progress, nextLevelXP } = getProgress(xp)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        Level {level} — {xp} XP
      </div>

      <div
        style={{
          height: 10,
          background: '#eee',
          borderRadius: 999,
          overflow: 'hidden',
          marginTop: 6,
        }}
      >
        <div
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            height: '100%',
            background: '#111',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        {Math.floor(nextLevelXP - xp)} XP to next level
      </div>
    </div>
  )
}