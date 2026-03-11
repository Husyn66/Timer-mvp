'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  post_id: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setErrorText(userError.message);
        setLoading(false);
        return;
      }

      if (!user) {
        setErrorText('User not authenticated');
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email ?? null);

      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, actor_id, type, post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setErrorText(error.message);
        setLoading(false);
        return;
      }

      setItems(data ?? []);
      setLoading(false);
    };

    run();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      <div className="rounded-xl border p-3 text-sm space-y-1">
        <div><strong>Current user ID:</strong> {currentUserId ?? '—'}</div>
        <div><strong>Current user email:</strong> {currentUserEmail ?? '—'}</div>
        <div><strong>Loading:</strong> {loading ? 'yes' : 'no'}</div>
        <div><strong>Error:</strong> {errorText ?? 'none'}</div>
        <div><strong>Items count:</strong> {items.length}</div>
      </div>

      {loading && <div>Loading...</div>}

      {!loading && errorText && (
        <div className="rounded-xl border p-3">
          Failed to load notifications: {errorText}
        </div>
      )}

      {!loading && !errorText && items.length === 0 && (
        <div className="rounded-xl border p-3">No notifications yet.</div>
      )}

      {!loading && !errorText && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border p-3">
              <div><strong>Type:</strong> {item.type}</div>
              <div><strong>Actor:</strong> {item.actor_id}</div>
              <div><strong>Post:</strong> {item.post_id ?? '—'}</div>
              <div><strong>Created:</strong> {new Date(item.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}