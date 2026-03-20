'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationRow = {
  id: string
  user_id: string
  actor_id: string
  type: string
  post_id: string | null
  created_at: string
  is_read: boolean
  read_at: string | null
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

function formatNotificationText(type: string, actorUsername: string | null) {
  const actor = actorUsername ? `@${actorUsername}` : 'Someone'

  if (type === 'like') return `${actor} liked your post.`
  if (type === 'comment') return `${actor} commented on your post.`
  if (type === 'follow') return `${actor} started following you.`

  return `${actor} sent you a notification.`
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const [items, setItems] = useState<NotificationRow[]>([])
  const [actorUsernames, setActorUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [markingIds, setMarkingIds] = useState<Record<string, boolean>>({})

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items]
  )

  function getHref(item: NotificationRow) {
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

  async function markAllAsRead() {
    if (markingAll || unreadCount === 0) return

    const unreadIds = items.filter((item) => !item.is_read).map((item) => item.id)
    if (unreadIds.length === 0) return

    setMarkingAll(true)
    setErrorText(null)

    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ all: true }),
      })

      const json = await res.json().catch(() => null)

      console.log('[notifications/page] markAllAsRead response', {
        status: res.status,
        ok: res.ok,
        json,
      })

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Failed to mark all as read')
      }

      const readAt =
        typeof json?.readAt === 'string' ? json.readAt : new Date().toISOString()

      setItems((prev) =>
        prev.map((item) =>
          item.is_read
            ? item
            : {
                ...item,
                is_read: true,
                read_at: readAt,
              }
        )
      )
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Failed to mark all as read'
      )
    } finally {
      setMarkingAll(false)
    }
  }

  async function markOneAsRead(id: string) {
    const target = items.find((item) => item.id === id)
    if (!target || target.is_read || markingIds[id]) return

    setMarkingIds((prev) => ({ ...prev, [id]: true }))
    setErrorText(null)

    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [id] }),
      })

      const json = await res.json().catch(() => null)

      console.log('[notifications/page] markOneAsRead response', {
        id,
        status: res.status,
        ok: res.ok,
        json,
      })

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Failed to mark notification as read')
      }

      const readAt =
        typeof json?.readAt === 'string' ? json.readAt : new Date().toISOString()

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                is_read: true,
                read_at: readAt,
              }
            : item
        )
      )
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'Failed to mark notification as read'
      )
    } finally {
      setMarkingIds((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  useEffect(() => {
    let active = true

    async function loadNotifications() {
      setLoading(true)
      setErrorText(null)
      setItems([])
      setActorUsernames({})

      try {
        const {
          data: { session },
          error: authError,
        } = await supabaseRef.current.auth.getSession()

        if (!active) return

        if (authError) {
          setErrorText(authError.message)
          setLoading(false)
          return
        }

        const user = session?.user ?? null

        if (!user) {
          setLoading(false)
          router.replace('/login')
          return
        }

        const { data: notificationRows, error: notificationsError } =
          await supabaseRef.current
            .from('notifications')
            .select(
              'id, user_id, actor_id, type, post_id, created_at, is_read, read_at'
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30)

        if (!active) return

        if (notificationsError) {
          setErrorText(notificationsError.message)
          setLoading(false)
          return
        }

        const rows = (notificationRows ?? []) as NotificationRow[]
        setItems(rows)

        const actorIds = Array.from(
          new Set(rows.map((row) => row.actor_id).filter(Boolean))
        )

        if (actorIds.length === 0) {
          setLoading(false)
          return
        }

        const { data: profileRows, error: profilesError } =
          await supabaseRef.current
            .from('profiles')
            .select('id, username')
            .in('id', actorIds)

        if (!active) return

        if (profilesError) {
          setErrorText(profilesError.message)
          setLoading(false)
          return
        }

        const usernameMap: Record<string, string> = {}

        ;((profileRows ?? []) as ProfileRow[]).forEach((row) => {
          const username = row.username?.trim() || ''
          if (username) {
            usernameMap[row.id] = username
          }
        })

        setActorUsernames(usernameMap)
        setLoading(false)
      } catch (error: unknown) {
        if (!active) return
        setErrorText(
          error instanceof Error ? error.message : 'Failed to load notifications'
        )
        setLoading(false)
      }
    }

    void loadNotifications()

    return () => {
      active = false
    }
  }, [router])

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          {!loading && !errorText && (
            <p className="text-sm text-gray-400">
              Unread: <span className="font-semibold text-white">{unreadCount}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={loading || markingAll || unreadCount === 0}
            className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/feed')}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Feed
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Home
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-gray-200">
          Loading notifications...
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
            const actorUsername = actorUsernames[item.actor_id] || null
            const message = formatNotificationText(item.type, actorUsername)
            const isMarkingThis = !!markingIds[item.id]

            const cardContent = (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${typeStyle.badge}`}
                    >
                      {getTypeLabel(item.type)}
                    </div>

                    {!item.is_read && (
                      <div className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                        Unread
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleString()}
                    </div>

                    {!item.is_read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void markOneAsRead(item.id)
                        }}
                        disabled={isMarkingThis}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isMarkingThis ? 'Marking...' : 'Mark as read'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 text-sm leading-6 text-gray-100">
                  {message}
                </div>

                {actorUsername && (
                  <div className="mt-3 text-sm text-gray-300">
                    Actor:{' '}
                    <span className="font-semibold text-sky-300">
                      @{actorUsername}
                    </span>
                  </div>
                )}

                {href && (
                  <div className="mt-4 text-sm font-medium text-sky-300">
                    Open →
                  </div>
                )}
              </>
            )

            const baseClassName = `rounded-2xl border p-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition duration-150 ${
              item.is_read
                ? 'border-white/10 bg-[rgba(17,24,39,0.62)] opacity-80'
                : `border-sky-400/20 bg-[rgba(17,24,39,0.88)] ${typeStyle.glow}`
            }`

            if (href) {
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={`block hover:no-underline ${baseClassName}`}
                >
                  {cardContent}
                </Link>
              )
            }

            return (
              <div key={item.id} className={baseClassName}>
                {cardContent}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}