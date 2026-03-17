'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationRow = {
  id: string
  user_id: string
  actor_id: string
  type: string
  post_id: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  username: string | null
}

function getTypeLabel(type: string) {
  if (type === 'like') return '❤️ Like'
  if (type === 'comment') return '💬 Comment'
  if (type === 'follow') return '👤 Follow'
  return '🔔 Notification'
}

function getTypeClasses(type: string) {
  if (type === 'like') {
    return {
      badge: 'bg-pink-500/15 text-pink-300 border-pink-400/20',
      glow: 'hover:border-pink-400/30',
    }
  }

  if (type === 'comment') {
    return {
      badge: 'bg-blue-500/15 text-blue-300 border-blue-400/20',
      glow: 'hover:border-blue-400/30',
    }
  }

  if (type === 'follow') {
    return {
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
      glow: 'hover:border-emerald-400/30',
    }
  }

  return {
    badge: 'bg-white/10 text-gray-200 border-white/10',
    glow: 'hover:border-white/20',
  }
}

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<NotificationRow[]>([])
  const [actorUsernames, setActorUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function run() {
      setLoading(true)
      setErrorText(null)

      try {
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession()

        if (!active) return

        if (authError) {
          setErrorText(authError.message)
          setLoading(false)
          return
        }

        const user = session?.user ?? null

        if (!user) {
          setErrorText('User not authenticated')
          setLoading(false)
          return
        }

        setCurrentUserId(user.id)
        setCurrentUserEmail(user.email ?? null)

        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, actor_id, type, post_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!active) return

        if (error) {
          setErrorText(error.message)
          setLoading(false)
          return
        }

        const rows = (data ?? []) as NotificationRow[]
        setItems(rows)

        const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter(Boolean)))

        if (actorIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', actorIds)

          if (!active) return

          if (profileError) {
            setErrorText(profileError.message)
            setLoading(false)
            return
          }

          const map: Record<string, string> = {}

          ;((profileRows ?? []) as ProfileRow[]).forEach((row) => {
            const cleaned = row.username?.trim() || ''
            if (cleaned) {
              map[row.id] = cleaned
            }
          })

          setActorUsernames(map)
        }

        setLoading(false)
      } catch (e: unknown) {
        if (!active) return
        setErrorText(e instanceof Error ? e.message : 'Failed to load notifications')
        setLoading(false)
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [supabase])

  const getHref = (item: NotificationRow) => {
    if ((item.type === 'like' || item.type === 'comment') && item.post_id) {
      return `/post/${item.post_id}`
    }

    if (item.type === 'follow') {
      const username = actorUsernames[item.actor_id]?.trim() || ''
      if (username) {
        return `/profile/${encodeURIComponent(username)}`
      }
    }

    return null
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 text-white">
      <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm space-y-1 text-gray-200">
        <div><strong>Current user ID:</strong> {currentUserId ?? '—'}</div>
        <div><strong>Current user email:</strong> {currentUserEmail ?? '—'}</div>
        <div><strong>Loading:</strong> {loading ? 'yes' : 'no'}</div>
        <div><strong>Error:</strong> {errorText ?? 'none'}</div>
        <div><strong>Items count:</strong> {items.length}</div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-gray-200">
          Loading...
        </div>
      )}

      {!loading && errorText && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
          Failed to load notifications: {errorText}
        </div>
      )}

      {!loading && !errorText && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-gray-300">
          No notifications yet.
        </div>
      )}

      {!loading && !errorText && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => {
            const typeStyle = getTypeClasses(item.type)
            const href = getHref(item)
            const actorUsername = actorUsernames[item.actor_id] || ''

            const cardContent = (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${typeStyle.badge}`}
                  >
                    {getTypeLabel(item.type)}
                  </div>

                  <div className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-200">
                  <div>
                    <span className="text-gray-400">Actor:</span>{' '}
                    <span className="font-medium break-all">
                      {actorUsername ? `@${actorUsername}` : item.actor_id}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400">Post:</span>{' '}
                    <span className="font-medium break-all">{item.post_id ?? '—'}</span>
                  </div>
                </div>

                {href && (
                  <div className="mt-4 text-sm font-medium text-sky-300">
                    Open →
                  </div>
                )}
              </>
            )

            if (href) {
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={`block rounded-2xl border border-white/10 bg-[rgba(17,24,39,0.82)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition duration-150 hover:bg-[rgba(30,41,59,0.92)] hover:no-underline ${typeStyle.glow}`}
                >
                  {cardContent}
                </Link>
              )
            }

            return (
              <div
                key={item.id}
                className={`rounded-2xl border border-white/10 bg-[rgba(17,24,39,0.82)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition duration-150 ${typeStyle.glow}`}
              >
                {cardContent}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}