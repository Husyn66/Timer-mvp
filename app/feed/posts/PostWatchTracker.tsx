'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type PostWatchTrackerProps = {
  postId: string;
  enabled?: boolean;
  tickSeconds?: number;
  minVisibleRatio?: number;
};

export default function PostWatchTracker({
  postId,
  enabled = true,
  tickSeconds = 5,
  minVisibleRatio = 0.6,
}: PostWatchTrackerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isVisibleRef = useRef(false);
  const mountedRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      isVisibleRef.current = false;

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      return;
    }

    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisibleRef.current =
          !!entry?.isIntersecting &&
          entry.intersectionRatio >= minVisibleRatio;
      },
      {
        threshold: [0, minVisibleRatio, 1],
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      isVisibleRef.current = false;
    };
  }, [enabled, minVisibleRatio]);

  useEffect(() => {
    if (!enabled || !postId) return;

    const sendWatchTime = async () => {
      if (!mountedRef.current) return;
      if (!isVisibleRef.current) return;
      if (document.visibilityState !== 'visible') return;

      const { error } = await supabase.rpc('add_watch_time', {
        p_post_id: postId,
        p_seconds: tickSeconds,
      });

      if (error) {
        console.error('PostWatchTracker:add_watch_time failed', {
          postId,
          tickSeconds,
          error,
        });
      }
    };

    intervalRef.current = window.setInterval(() => {
      void sendWatchTime();
    }, tickSeconds * 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, postId, supabase, tickSeconds]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      style={{
        width: '100%',
        height: 1,
        pointerEvents: 'none',
        opacity: 0,
      }}
    />
  );
}