-- Phase 0 (notification redesign): stop the dispatcher clobbering system_config.flags.
--
-- dispatch-scheduled-pushes ran every minute doing a read-modify-write of the
-- ENTIRE flags jsonb to drop fired pushes. classOverrides (class cancellations)
-- live in the same blob, so an admin cancelling a class in the same minute could
-- be clobbered — silently un-cancelling a class and pushing wrong info to
-- students. This RPC updates ONLY the scheduledPushes key in a single atomic
-- UPDATE, leaving every other flag (classOverrides, etc.) untouched.
--
-- Throwaway-by-design: scheduled pushes fully migrate to the `notifications`
-- table in Phase 2, at which point this function and the flags-based queue go
-- away. See docs/notification-architecture.md.

create or replace function dequeue_scheduled_pushes(remaining jsonb)
returns void
language sql
as $$
  update system_config
     set flags      = jsonb_set(coalesce(flags, '{}'::jsonb), '{scheduledPushes}', coalesce(remaining, '[]'::jsonb)),
         updated_at = now()
   where id = 'global';
$$;

-- Only the dispatcher (service role) may call this. Postgres grants EXECUTE to
-- PUBLIC by default and Supabase exposes public functions to anon/authenticated
-- via PostgREST — without this revoke, any logged-in user could rewrite the
-- scheduled-push queue.
revoke all on function dequeue_scheduled_pushes(jsonb) from public;
grant execute on function dequeue_scheduled_pushes(jsonb) to service_role;
