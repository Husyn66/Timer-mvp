import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_NOTIFICATION_IDS_PER_REQUEST = 100

export async function POST(req: Request) {
  try {
    console.log('[notifications/read] POST called')

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log('[notifications/read] auth result', {
      hasUser: !!user,
      userId: user?.id ?? null,
      authError: authError?.message ?? null,
    })

    if (authError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: authError?.message || 'User not authenticated',
        },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))

    const all = body?.all === true
    const rawIds = Array.isArray(body?.ids) ? body.ids : []

    const ids = rawIds
      .filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
      .slice(0, MAX_NOTIFICATION_IDS_PER_REQUEST)

    console.log('[notifications/read] request payload', {
      all,
      rawIdsCount: rawIds.length,
      filteredIdsCount: ids.length,
      idsPreview: ids.slice(0, 10),
    })

    const now = new Date().toISOString()

    let query = supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now,
      })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (!all) {
      if (ids.length === 0) {
        console.log('[notifications/read] no ids provided, nothing to update')
        return NextResponse.json({
          ok: true,
          readAt: now,
          updatedCount: 0,
        })
      }

      query = query.in('id', ids)
    }

    const { data, error } = await query.select('id')

    console.log('[notifications/read] update result', {
      updatedCount: data?.length ?? 0,
      updatedIds: data?.map((row) => row.id) ?? [],
      error: error?.message ?? null,
    })

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      readAt: now,
      updatedCount: data?.length ?? 0,
      updatedIds: data?.map((row) => row.id) ?? [],
    })
  } catch (error) {
    console.error('[notifications/read] unexpected error', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 }
    )
  }
}