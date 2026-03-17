'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

function formatNotificationText(type: string, actorUsername: string | null) {
  const actor = actorUsername ? `@${actorUsername}` : 'Someone'

  if (type === 'like') return `${actor} liked your post.`
  if (type === 'comment') return `${actor} commented on your post.`
  if (type === 'follow') return `${actor} started following you.`

  return `${actor} sent you a notification.`
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState<NotificationRow[]>([])
  const [actorUsernames, setActorUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState<string | null>(null)

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
          router.replace('/login')
          return
        }

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
  }, [router, supabase])

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
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 text-white">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => router.push('/feed')}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Feed
          </button>

          <button
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

                <div className="mt-4 text-sm text-gray-100 leading-6">{message}</div>

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
    </main>
  )
}