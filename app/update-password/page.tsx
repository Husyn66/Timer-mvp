'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function parseHashParams(hash: string) {
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleanHash);

  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
    error_description: params.get('error_description'),
    error_code: params.get('error_code'),
  };
}

export default function UpdatePasswordPage() {
  const supabaseRef = useRef(createClient());
  const router = useRouter();

  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function initRecoverySession() {
      const supabase = supabaseRef.current;

      if (cancelled) return;

      setCheckingSession(true);
      setError('');
      setMessage('');
      setHasRecoverySession(false);

      try {
        const url = new URL(window.location.href);
        const hashData = parseHashParams(window.location.hash);
        const code = url.searchParams.get('code');

        if (hashData.error_description) {
          if (cancelled) return;
          setError(hashData.error_description);
          setCheckingSession(false);
          return;
        }

        // Case 1: recovery tokens are in URL hash
        if (
          hashData.type === 'recovery' &&
          hashData.access_token &&
          hashData.refresh_token
        ) {
          const { error } = await supabase.auth.setSession({
            access_token: hashData.access_token,
            refresh_token: hashData.refresh_token,
          });

          if (cancelled) return;

          if (error) {
            setError(error.message);
            setCheckingSession(false);
            return;
          }

          setHasRecoverySession(true);
          setCheckingSession(false);

          window.history.replaceState({}, document.title, url.pathname);
          return;
        }

        // Case 2: one-time auth code is in query string
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (cancelled) return;

          if (error) {
            setError(error.message);
            setCheckingSession(false);
            return;
          }

          setHasRecoverySession(true);
          setCheckingSession(false);

          url.searchParams.delete('code');
          const cleanSearch = url.searchParams.toString();
          const cleanUrl = cleanSearch ? `${url.pathname}?${cleanSearch}` : url.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          return;
        }

        // Do not treat an ordinary existing session as a recovery session.
        if (cancelled) return;

        setError(
          'Recovery session not found. Open the latest reset link from your email again.'
        );
        setCheckingSession(false);
      } catch {
        if (cancelled) return;
        setError('Failed to initialize password recovery session.');
        setCheckingSession(false);
      }
    }

    initRecoverySession();

    return () => {
      cancelled = true;

      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();

    if (loading || checkingSession) return;

    setError('');
    setMessage('');

    if (!hasRecoverySession) {
      setError(
        'Auth session missing. Open the latest reset link from your email again.'
      );
      return;
    }

    if (!password || !confirmPassword) {
      setError('Fill in both password fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabaseRef.current.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage('Password updated successfully. Redirecting to login...');

    redirectTimeoutRef.current = setTimeout(() => {
      router.replace('/login');
    }, 1200);
  }

  const isFormDisabled = loading || checkingSession || !hasRecoverySession;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-bold">Update password</h1>

      {checkingSession ? (
        <p className="mb-4 text-sm text-gray-400">
          Checking recovery session...
        </p>
      ) : null}

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isFormDisabled}
          className="w-full rounded border px-3 py-2 disabled:opacity-50"
          autoComplete="new-password"
        />

        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isFormDisabled}
          className="w-full rounded border px-3 py-2 disabled:opacity-50"
          autoComplete="new-password"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-600">{message}</p> : null}

        <button
          type="submit"
          disabled={isFormDisabled}
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Save new password'}
        </button>
      </form>
    </main>
  );
}