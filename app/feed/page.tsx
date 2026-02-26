'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type FeedPost = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string | null;
};

export default function FeedPage() {
  const supabase = createClient();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  async function loadFeed() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('feed_posts')
      .select('id, user_id, content, created_at, username')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
      setPosts([]);
      setLoading(false);
      return;
    }

    setPosts((data ?? []) as FeedPost[]);
    setLoading(false);
  }

  async function createPost() {
    const text = content.trim();
    if (!text) return;

    setPosting(true);
    setError('');

    // Важно: пишем в posts (база истины), а читаем из feed_posts (view)
    const { error } = await supabase.from('posts').insert({ content: text });

    if (error) {
      setError(error.message);
      setPosting(false);
      return;
    }

    setContent('');
    setPosting(false);
    await loadFeed();
  }

  useEffect(() => {
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Feed</h1>
        <button
          onClick={loadFeed}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #2b2b2b',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </header>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 16,
          border: '1px solid #2b2b2b',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Что нового?"
            maxLength={280}
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              padding: 12,
              borderRadius: 12,
              border: '1px solid #2b2b2b',
              background: 'transparent',
              color: 'inherit',
            }}
          />
          <button
            onClick={createPost}
            disabled={posting || content.trim().length === 0}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid #2b2b2b',
              background: posting ? '#222' : '#3b82f6',
              color: 'white',
              cursor: posting ? 'not-allowed' : 'pointer',
              minWidth: 86,
            }}
          >
            {posting ? '...' : 'Post'}
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          {content.length}/280
        </div>

        {error ? (
          <div style={{ marginTop: 10, color: '#ff6b6b', fontSize: 13 }}>
            {error}
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 18 }}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>Loading…</div>
        ) : posts.length === 0 ? (
          <div style={{ opacity: 0.8 }}>Пока нет постов.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map((p) => (
              <article
                key={p.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: '1px solid #2b2b2b',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>
                    {p.username ?? 'unknown'}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{p.content}</div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => alert('Like: UI only (logic later)')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: '1px solid #2b2b2b',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    ❤️ Like
                  </button>

                  <button
                    onClick={() => alert('Comment: later')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: '1px solid #2b2b2b',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    💬 Comment
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}