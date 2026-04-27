ALTER FUNCTION public.set_updated_at()
SET search_path = public, pg_temp;

ALTER FUNCTION public.is_valid_weekday_array(smallint[])
SET search_path = public, pg_temp;

ALTER FUNCTION public.enforce_habit_log_user_match()
SET search_path = public, pg_temp;

DROP VIEW IF EXISTS public.active_sessions;

CREATE VIEW public.active_sessions
WITH (security_invoker = true) AS
SELECT *
FROM public.sessions
WHERE revoked_at IS NULL
  AND expires_at > NOW();
