-- Timer MVP
-- Current working database state snapshot
-- Date: 2026-03-22
-- Purpose:
-- This file is a manual SQL snapshot of the current working Supabase DB state.
-- It exists because SQL changes were applied directly in Supabase and are not yet tracked
-- through formal migrations. Treat this file as the current repo-side source of truth
-- for critical MVP database objects until proper migrations are introduced.

-- =========================================================
-- 1. CORE TABLES
-- =========================================================
-- Paste here the current working SQL definitions for:
-- profiles
-- posts
-- post_likes
-- post_comments
-- notifications
-- xp_events
-- post_watch_time
-- post_watch_events
-- post_watch_aggregate
-- watch_buckets

-- Example:
-- create table if not exists public.profiles ( ... );
-- alter table public.profiles ...;
-- create index if not exists ...;

-- =========================================================
-- 2. VIEWS
-- =========================================================
-- Paste here the current working SQL definitions for:
-- feed_posts
-- feed_ranked
-- feed_following
-- post_comment_items
-- post_like_counts
-- post_stats

-- Example:
-- create or replace view public.feed_posts as
-- select ...

-- =========================================================
-- 3. FUNCTIONS / RPC
-- =========================================================
-- Paste here the current working SQL definitions for:
-- grant_xp
-- any watch-time related RPC
-- any profile/level/xp helper functions
-- any notification helper functions if they are important for MVP

-- Example:
-- create or replace function public.grant_xp(...)
-- returns ...
-- language plpgsql
-- as $$
-- begin
--   ...
-- end;
-- $$;

-- =========================================================
-- 4. TRIGGERS
-- =========================================================
-- Paste here the current working SQL definitions for:
-- xp related triggers
-- notification related triggers
-- watch-time related triggers
-- profile auto-create triggers
-- any trigger that is required for the current MVP loop

-- Example:
-- create trigger ...
-- after insert on ...
-- for each row execute function ...;

-- =========================================================
-- 5. RLS POLICIES
-- =========================================================
-- Paste here the current working SQL definitions for critical MVP policies on:
-- profiles
-- posts
-- post_likes
-- post_comments
-- notifications
-- watch-time tables
-- xp tables

-- Example:
-- alter table public.posts enable row level security;
-- create policy "Users can read posts" on public.posts
-- for select
-- using (...);

-- =========================================================
-- 6. NOTES ABOUT KNOWN LIVE STATE -- - post_comments is the actual comments table in use
-- - comments table does not exist
-- - notifications table is working and stores like/comment/follow notifications
-- - XP is confirmed to be granted for social events
-- - confirmed social XP events include post_liked and comment_received
-- - XP writes are reflected in xp_events and profiles.xp_total
-- - profile progress is visible through profile XP / level data
-- - watch-time tables/views exist in the project database state
-- - watch-time write path existed previously, but watch-time -> XP linkage is not yet confirmed
-- - watch-time -> XP is currently an open audit item
-- =========================================================
-- Write short factual notes only.
-- No essays. No guesses.

-- Example notes:
-- - post_comments is the actual comments table in use
-- - comments table does not exist
-- - xp is currently confirmed for likes/comments
-- - watch-time write path exists / not yet confirmed
-- - watch-time -> xp linkage is confirmed / not yet confirmed
-- - profile progress reads from profiles.xp_total and/or profiles.level

-- =========================================================
-- 7. OPEN GAPS-- - Need to confirm whether watch-time currently grants XP
-- - Need to confirm which exact event is the XP trigger for watch-time: seconds watched, completion, bucket write, or another signal
-- - Need to confirm where watch-time logic currently lives: client code, server action, SQL function, trigger, or RPC
-- - Need to confirm whether watch-time writes are deduplicated safely
-- - Need to confirm which profile fields are the source of visible progress: xp_total, xp, level, or a combination
-- =========================================================
-- List only critical unknowns that still need audit.

-- Example:
-- - Need to confirm whether watch-time currently grants XP
-- - Need to confirm whether completion signal calls any XP function
-- - Need to confirm whether bucket writes are deduplicated