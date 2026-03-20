import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProfileRedirectPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          Failed to load your profile.
        </div>
      </main>
    )
  }

  const username = profile?.username?.trim()

  if (!username) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-gray-200">
          Your profile username is missing.
        </div>
      </main>
    )
  }

  redirect(`/profile/${encodeURIComponent(username)}`)
}