'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationType = string

type NotificationRow = {
  id: string
  user_id: string
  actor_id: string
  type: NotificationType
  post_id: string | null
  created_at: string
  read_at: string | null
  is_read: boolean
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
      unreadRing: 'ring-1 ring-pink-400/20',
      unreadBg: 'bg-[rgba(40,16,28,0.72)]',
    }
  }

  if (type === 'comment') {
    return {
      badge: 'bg-blue-500/15 text-blue-300 border-blue-400/20',
      glow: 'hover:border-blue-400/30',
      unreadRing: 'ring-1 ring-blue-400/20',
      unreadBg: 'bg-[rgba(15,28,46,0.78)]',
    }
  }

  if (type === 'follow') {
    return {
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
      glow: 'hover:border-emerald-400/30',
      unreadRing: 'ring-1 ring-emerald-400/20',
      unreadBg: 'bg-[rgba(16,34,29,0.76)]',
    }
  }

  return {
    badge: 'bg-white/10 text-gray-200 border-white/10',
    glow: 'hover:border-white/20',
    unreadRing: 'ring-1 ring-white/10',
    unreadBg: 'bg-[rgba(24,24,27,0.82)]',
  }
}

function formatAbsolute(dateString: string) {
  return new Date(dateString).toLocaleString()
}

function formatRelative(dateString: string) {
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

function getActionText(type: string) {
  if (type === 'like') return 'liked your post'
  if (type === 'comment') return 'commented on your post'
  if (type === 'follow') return 'started following you'
  return 'interacted with you'
}

function getInitial(username: string | null | undefined) {
  const cleaned = username?.trim() || ''
  return cleaned ? cleaned.charAt(0).toUpperCase() : 'U'
}

export default function NotificationsPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient()
  }

  const markReadStartedRef = useRef(false)

  const [items, setItems] = useState<NotificationRow[]>([])
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileRow>>({})
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState(false)

  useEffect(() => {
    let active = true

    async function run() {
      setLoading(true)
      setErrorText(null)

      try {
        const supabase = supabaseRef.current

        if (!supabase) {
          if (active) {
            setErrorText('Supabase client is not available.')
            setLoading(false)
          }
          return
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (!active) return

        if (authError) {
          setErrorText(authError.message)
          setLoading(false)
          return
        }

        if (!user) {
          setItems([])
          setProfilesMap({})
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, actor_id, type, post_id, created_at, read_at, is_read')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)

        if (!active) return

        if (error) {
          setErrorText(error.message)
          setLoading(false)
          return
        }

        const rows = (data ?? []) as NotificationRow[]

        const actorIds = Array.from(
          new Set(rows.map((row) => row.actor_id).filter(Boolean))
        ) as string[]

        let nextProfilesMap: Record<string, ProfileRow> = {}

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

          for (const row of (profileRows ?? []) as ProfileRow[]) {
            nextProfilesMap[row.id] = row
          }
        }

        setProfilesMap(nextProfilesMap)
        setItems(rows)

        const unreadIds = rows.filter((row) => !row.is_read).map((row) => row.id)

        if (unreadIds.length > 0 && !markReadStartedRef.current) {
          markReadStartedRef.current = true
          setMarkingRead(true)

          const now = new Date().toISOString()

          const { error: updateError } = await supabase
            .from('notifications')
            .update({
              is_read: true,
              read_at: now,
            })
            .eq('user_id', user.id)
            .in('id', unreadIds)
            .eq('is_read', false)

          if (!active) return

          if (!updateError) {
            setItems((prev) =>
              prev.map((item) =>
                unreadIds.includes(item.id)
                  ? {
                      ...item,
                      is_read: true,
                      read_at: now,
                    }
                  : item
              )
            )
          }

          setMarkingRead(false)
        } else {
          setMarkingRead(false)
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
  }, [])

  const getHref = (item: NotificationRow) => {
    if ((item.type === 'like' || item.type === 'comment') && item.post_id) {
      return `/post/${item.post_id}`
    }

    if (item.type === 'follow') {
      const username = profilesMap[item.actor_id]?.username?.trim() || ''
      if (username) {
        return `/profile/${encodeURIComponent(username)}`
      }
    }

    return null
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        {markingRead ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
            Marking as read...
          </div>
        ) : null}
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
            const actor = profilesMap[item.actor_id]
            const actorUsername = actor?.username?.trim() || ''
            const actorLabel = actorUsername ? `@${actorUsername}` : item.actor_id

            const cardContent = (
              <>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
                        {getInitial(actorUsername)}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${typeStyle.badge}`}
                        >
                          {getTypeLabel(item.type)}
                        </div>

                        {!item.is_read ? (
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                        ) : null}
                      </div>

                      <div className="mt-2 text-sm text-gray-100 break-words">
                        <span className="font-semibold">{actorLabel}</span>{' '}
                        <span className="text-gray-300">{getActionText(item.type)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 shrink-0">
                    {formatRelative(item.created_at)}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-200">
                  <div>
                    <span className="text-gray-400">Actor:</span>{' '}
                    <span className="font-medium break-all">{actorLabel}</span>
                  </div>

                  <div>
                    <span className="text-gray-400">Post:</span>{' '}
                    <span className="font-medium break-all">{item.post_id ?? '—'}</span>
                  </div>

                  <div>
                    <span className="text-gray-400">Date:</span>{' '}
                    <span className="font-medium break-all">
                      {formatAbsolute(item.created_at)}
                    </span>
                  </div>
                </div>

                {href && (
                  <div className="mt-4 text-sm font-medium text-sky-300">
                    Open →
                  </div>
                )}
              </>
            )

            const cardClassName = [
              'block rounded-2xl border border-white/10 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition duration-150',
              item.is_read
                ? 'bg-[rgba(17,24,39,0.82)] hover:bg-[rgba(30,41,59,0.92)]'
                : `${typeStyle.unreadBg} ${typeStyle.unreadRing} hover:bg-[rgba(30,41,59,0.92)]`,
              typeStyle.glow,
            ].join(' ')

            if (href) {
              return (
                <Link key={item.id} href={href} className={cardClassName}>
                  {cardContent}
                </Link>
              )
            }

            return (
              <div key={item.id} className={cardClassName}>
                {cardContent}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}