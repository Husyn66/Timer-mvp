'use client'

import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const btnStyle: CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #555',
    background: '#eee',
    color: '#111',
    cursor: 'pointer',
    fontWeight: 700,
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    border: '1px solid #444',
    background: 'transparent',
    color: 'inherit',
  }

  const uploadImage = async (userId: string, selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(fileName, selectedFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`)
    }

    const { data } = supabase.storage.from('post-images').getPublicUrl(fileName)

    if (!data?.publicUrl) {
      throw new Error('Image upload succeeded, but public URL was not generated.')
    }

    return data.publicUrl
  }

  const handleCreatePost = async () => {
    setPosting(true)
    setMessage('')
    setError('')

    try {
      const trimmed = content.trim()

      if (!trimmed && !file) {
        throw new Error('Write something or choose an image.')
      }

      const { data: authRes, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw new Error(`Auth error: ${authErr.message}`)

      const user = authRes.user
      if (!user) {
        router.push('/login')
        return
      }

      let imageUrl: string | null = null

      if (file) {
        imageUrl = await uploadImage(user.id, file)
      }

      const { error: insertErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content: trimmed || null,
        image_url: imageUrl,
      })

      if (insertErr) {
        throw new Error(`Post insert failed: ${insertErr.message}`)
      }

      setContent('')
      setFile(null)
      setMessage('Post created successfully.')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : JSON.stringify(e)
      setError(msg)
    } finally {
      setPosting(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Timer MVP</h1>

        <button onClick={() => router.push('/feed')} style={btnStyle}>
          Open Feed
        </button>
      </div>

      <section
        style={{
          border: '1px solid #444',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Create Post</h2>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write something..."
          rows={5}
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: 120,
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={btnStyle}
          >
            Choose Image
          </button>

          <span style={{ fontSize: 14, opacity: 0.85 }}>
            {file ? `Selected: ${file.name}` : 'No file selected'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={handleCreatePost} disabled={posting} style={btnStyle}>
            {posting ? 'Posting...' : 'Publish Post'}
          </button>
        </div>

        {message && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              border: '1px solid #2f8f2f',
              borderRadius: 10,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              border: '1px solid #f00',
              borderRadius: 10,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </div>
        )}
      </section>
    </main>
  )
}