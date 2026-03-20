'use server'

import { createClient } from '@/lib/supabase/server'

const MAX_NOTIFICATION_IDS_PER_REQUEST = 100

export async function markNotificationsAsReadAction(ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: true }
  }

  const safeIds = ids.filter((id) => typeof id === 'string' && id.trim().length > 0)

  if (safeIds.length === 0) {
    return { ok: true }
  }

  if (safeIds.length > MAX_NOTIFICATION_IDS_PER_REQUEST) {
    return {
      ok: false,
      error: 'Too many IDs',
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      error: authError?.message || 'User not authenticated',
    }
  }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: now,
    })
    .eq('user_id', user.id)
    .in('id', safeIds)
    .eq('is_read', false)

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  return {
    ok: true,
    readAt: now,
  }
}